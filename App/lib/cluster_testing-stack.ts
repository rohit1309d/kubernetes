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
      instanceSize: ec2.InstanceSize.MEDIUM,
      deploymentProps: {
        deploymentName: 'The-Deployment-Test',
        dockerImage: 'stefanprodan/podinfo',
        servicePort: 80,
        containerPort: 9898,
      },
    });
  }
}
