import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import * as cdk from '@aws-cdk/core';
import * as cdk8s from 'cdk8s';
import { DeploymentConstruct, DeploymentProps } from './DeploymentConstruct';
let yaml:any = require('js-yaml');
let request:any = require('sync-request');

export interface ClusterProps {

  /**
   * Name of the cluster
   *
   */
  readonly clusterName: string;

  /**
   * Kubernetes Version
   *
   * @default eks.KubernetesVersion.V1_19
   *
   */
  readonly kubernetesVersion?: eks.KubernetesVersion;

  /**
   * Instance Class
   *
   * @default ec2.InstanceClass.T2
   *
   */
  readonly instanceClass?: ec2.InstanceClass;

  /**
   * Instance size
   *
   * @default ec2.instanceSize.MEDIUM
   *
   */
  readonly instanceSize?: ec2.InstanceSize;

  /**
   * VPC for cluster
   *
   * @default - Assigned by CloudFormation.
   *
   */
  readonly vpc?: string;

  /**
   * Props for deployment
   *
   */
  readonly deploymentProps: DeploymentProps;
};


export class ClusterConstruct extends cdk.Construct {

  cluster: eks.Cluster;

  constructor(scope: cdk.Construct, id: string, props: ClusterProps ) {

    if (props.clusterName.length > 64) {
      throw new Error('clusterName cannot exceed 64 characters');
    };
    super(scope, id);

    const vpc = props.vpc? ec2.Vpc.fromLookup(this, props.vpc || 'myVpc', { vpcId: props.vpc }) : new ec2.Vpc(this, id + '-vpc');
    const instance = ec2.InstanceType.of(props.instanceClass || ec2.InstanceClass.T2, props.instanceSize || ec2.InstanceSize.MEDIUM);

    this.cluster = new eks.Cluster(this, props.clusterName, {
      clusterName: props.clusterName,
      vpc: vpc,
      defaultCapacityInstance: instance,
      version: props.kubernetesVersion || eks.KubernetesVersion.V1_19,
    });

    this.cluster.addCdk8sChart('deployment-chart', new DeploymentConstruct(new cdk8s.App(), props.clusterName + 'Deployment', props.deploymentProps));

    const manifestUrl = 'https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml';
    const manifest = yaml.loadAll(request('GET', manifestUrl).getBody());
    this.cluster.addManifest('metrics-server', ...manifest);


    // this.cluster.addHelmChart('metrics-server', {
    //   repository: 'https://charts.bitnami.com/bitnami',
    //   chart: 'metrics-server',
    //   release: 'metrics-server',
    //   namespace: 'kube-system',
    // });

    // this.cluster.addHelmChart('kube-dashboard', {
    //   repository: 'https://kubernetes.github.io/dashboard',
    //   chart: 'kubernetes-dashboard',
    //   release: 'kubernetes-dashboard',
    //   namespace: 'kubernetes-dashboard',
    //   values: {
    //     service: {
    //       type: 'LoadBalancer',
    //     },
    //   },
    // });

    // this.cluster.addManifest('eks-admin', {
    //   apiVersion: 'v1',
    //   kind: 'ServiceAccount',
    //   metadata: {
    //     name: 'eks-admin',
    //     namespace: 'kube-system',
    //   }
    // });

    // this.cluster.addManifest('eks-admin-clusterrolebinding', {
    //   apiVersion: 'rbac.authorization.k8s.io/v1beta1',
    //   kind: 'ClusterRoleBinding',
    //   metadata: {
    //     name: 'eks-admin',
    //   },
    //   roleRef: {
    //     apiGroup: 'rbac.authorization.k8s.io',
    //     kind: 'ClusterRole',
    //     name: 'cluster-admin',
    //   },
    //   subjects: [
    //     {
    //       kind: 'ServiceAccount',
    //       name: 'eks-admin',
    //       namespace: 'kube-system',
    //     },
    //   ],
    // });
  }
}