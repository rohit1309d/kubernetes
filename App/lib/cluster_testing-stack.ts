import * as cdk from '@aws-cdk/core';//
import * as kplus from 'cdk8s-plus';
import { ClusterConstruct } from './ClusterConstruct';
import * as ec2 from '@aws-cdk/aws-ec2';

export class ClusterTestingStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const cluster = new ClusterConstruct(this, 'The-Test-Cluster', {
      clusterName: 'The-Cluster-name',
      instanceClass:ec2.InstanceClass.T2,
      instanceSize: ec2.InstanceSize.XLARGE,
      deployKubeDashboard: true,
      // domainNameForApp: 'kube-dashboard.enthires.com',
      exposeAppUsingIngress: true,
      exposeKubeDashboardUsingIngress: true,
      deployKibanaDashboard: true,
      exposeKibanaDashboardUsingIngress: true,
      deploymentProps: {
        deploymentName: 'The-Deployment-Test',
        dockerImage: '577753415598.dkr.ecr.us-east-2.amazonaws.com/helloworld',
        servicePort: 80,
        containerPort: 3000,
      },
    });
  }
}