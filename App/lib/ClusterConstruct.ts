import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import * as cdk from '@aws-cdk/core';
import * as cdk8s from 'cdk8s';
import { DeploymentConstruct, DeploymentProps } from './DeploymentConstruct';

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
   * @default ec2.instanceSize.MICRO
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
    super(scope, id);

    const vpc = props.vpc? ec2.Vpc.fromLookup(this, props.vpc || 'myVpc', { vpcId: props.vpc }) : new ec2.Vpc(this, id + '-vpc');
    const instance = ec2.InstanceType.of(props.instanceClass || ec2.InstanceClass.T2, props.instanceSize || ec2.InstanceSize.MICRO);

    this.cluster = new eks.Cluster(this, props.clusterName, {
      vpc: vpc,
      defaultCapacityInstance: instance,
      version: props.kubernetesVersion || eks.KubernetesVersion.V1_19,
    });

    this.cluster.addCdk8sChart('deployment-chart', new DeploymentConstruct(new cdk8s.App(), props.clusterName + 'Deployment', props.deploymentProps));
  }
}