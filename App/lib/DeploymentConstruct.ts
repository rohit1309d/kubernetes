import * as cdk8s from 'cdk8s';
import * as kplus from 'cdk8s-plus';
import { Construct } from 'constructs';

export interface DeploymentProps {
  /**
   * Name of the Deployment
   *
   * @default - Assigned by CloudFormation (recommended).
   */
  readonly deploymentName: string;

  /**
   * Number of the replicas
   *
   * @default 2
   */
  readonly replicas?: number;

  /**
   * Name of docker image
   */
  readonly dockerImage: string;

  /**
   * Service Type
   *
   * @default kplus.ServiceType.LOAD_BALANCER
   *
   */
  readonly serviceType?: kplus.ServiceType;

  /**
   * Service Port number
   *
   * @default 80
   *
   */
  readonly servicePort: number;

  /**
   * Container Port number
   *
   * @default 3000
   *
   */
  readonly containerPort?: number;
}

export class DeploymentConstruct extends cdk8s.Chart {

  deployment: kplus.Deployment;
  service: kplus.Service;

  constructor(scope: Construct, id: string, props: DeploymentProps ) {
    super(scope, id);

    this.deployment = new kplus.Deployment(this, props.deploymentName, {
      replicas: props.replicas || 2,
      containers: [new kplus.Container({
        image: props.dockerImage,
        port: props.containerPort || 3000,
      })],
    });

    this.service = this.exposeDeployment(props.servicePort || 80, props.serviceType || kplus.ServiceType.LOAD_BALANCER);
  }

  exposeDeployment(servicePort: number, serviceType: kplus.ServiceType) {
    return this.deployment.expose(servicePort, {
      serviceType: serviceType,
    });
  }
}