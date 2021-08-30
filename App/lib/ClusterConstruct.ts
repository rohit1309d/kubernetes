import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import * as cdk from '@aws-cdk/core';
import * as cdk8s from 'cdk8s';
import { DeploymentConstruct, DeploymentProps } from './DeploymentConstruct';
// eslint-disable-next-line @typescript-eslint/no-require-imports
let yaml:any = require('js-yaml');
// eslint-disable-next-line @typescript-eslint/no-require-imports
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
   * Expose App using Ingress?
   *
   * @default false
   *
   */
   readonly exposeAppUsingIngress?: boolean;

  /**
   * Domain name for App
   *
   */
  readonly domainNameForApp?: string;

  /**
   * Url path for App
   *
   * default - /
   *
   */
  readonly urlPathForApp?: string;

   /**
   * deploy KubeDashboard?
   *
   * @default true
   *
   */
  readonly deployKubeDashboard?: boolean;

  /**
   * Expose Kube Dashboard using Ingress?
   *
   * @default false
   *
   */
  readonly exposeKubeDashboardUsingIngress?: boolean;

  /**
   * domain name for KubeDashboard
   *
   * default - same domainName as domainNameForApp
   *
   */
  readonly domainNameForKubeDashboard?: string;

  /**
   * deploy KibanaDashboard?
   *
   * @default false
   *
   */
  readonly deployKibanaDashboard?: boolean;

   /**
    * Expose Kibana Dashboard using Ingress?
    *
    * @default false
    *
    */
    readonly exposeKibanaDashboardUsingIngress?: boolean;
 
   /**
    * domain name for KibanaDashboard
    *
    * default - same domainName as domainNameForApp
    *
    */
   readonly domainNameForKibanaDashboard?: string;

  /**
   * Props for deployment
   *
   */
  readonly deploymentProps: DeploymentProps;
};


export class ClusterConstruct extends cdk.Construct {

  cluster: eks.Cluster;
  deployment: DeploymentConstruct;

  constructor(scope: cdk.Construct, id: string, props: ClusterProps ) {

    if (props.clusterName.length > 64) {
      throw new Error('clusterName cannot exceed 64 characters');
    };

    if (props.exposeKubeDashboardUsingIngress && !props.deployKubeDashboard) {
      throw new Error('deployKubeDashboard cannot be false when exposeKubeDashboardUsingIngress is true')
    }

    if (props.exposeKibanaDashboardUsingIngress && !props.deployKibanaDashboard) {
      throw new Error('deployKibanaDashboard cannot be false when exposeKibanaDashboardUsingIngress is true')
    }

    super(scope, id);

    const vpc = props.vpc? ec2.Vpc.fromLookup(this, props.vpc || 'myVpc', { vpcId: props.vpc }) : new ec2.Vpc(this, id + '-vpc');
    const instance = ec2.InstanceType.of(props.instanceClass || ec2.InstanceClass.T2, props.instanceSize || ec2.InstanceSize.MEDIUM);

    this.cluster = new eks.Cluster(this, props.clusterName, {
      clusterName: props.clusterName,
      defaultCapacity: 3,
      vpc: vpc,
      defaultCapacityInstance: instance,
      version: props.kubernetesVersion || eks.KubernetesVersion.V1_19,
    });

    this.deployment = new DeploymentConstruct(new cdk8s.App(), props.clusterName + 'Deployment', props.deploymentProps);
    this.cluster.addCdk8sChart('deployment-chart', this.deployment);

    if (props.deployKubeDashboard) {
      this.deployDashboard();
    }

    if (props.exposeAppUsingIngress || props.exposeKubeDashboardUsingIngress) {
      this.addManifestFromUrl('nginx-ingress', 'https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v0.48.1/deploy/static/provider/aws/deploy.yaml');
    }

    if (props.exposeAppUsingIngress) {
      this.exposeUsingNginx('app-ingress', 
      {
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
        'kubernetes.io/ingress.class': 'nginx',
      },
      props.domainNameForApp,
      props.urlPathForApp,
      'Prefix',
      this.deployment.service.name,
      this.deployment.service.ports[0].port,);
    }

    if (props.exposeKubeDashboardUsingIngress) {
      this.exposeUsingNginx('dashboard-ingress',
      {
        'nginx.ingress.kubernetes.io/backend-protocol': 'HTTPS',
        'nginx.ingress.kubernetes.io/rewrite-target': '/$2',
        'nginx.ingress.kubernetes.io/use-regex': 'true',
        'nginx.ingress.kubernetes.io/configuration-snippet': 'rewrite ^(/dashboard)$ $1/ redirect;\n'
      },
      props.domainNameForApp,
      '/dashboard(/|$)(.*)',
      'ImplementationSpecific',
      'kubernetes-dashboard',
      443,
      'kubernetes-dashboard');
    }

    if (props.deployKibanaDashboard) {
      
      if (props.exposeKibanaDashboardUsingIngress)
        this.deployKibanaDashboard(props.exposeKibanaDashboardUsingIngress, props.domainNameForKibanaDashboard || props.domainNameForApp);
      else
        this.deployKibanaDashboard(false);
    }
  }

  addManifestFromUrl(manifestName: string, manifestUrl: string) {
    const manifest = yaml.loadAll(request('GET', manifestUrl).getBody());
    this.cluster.addManifest(manifestName, ...manifest);
  }

  deployDashboard() {
    // Add metrics server
    this.addManifestFromUrl('metrics-server', 'https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml');

    // Add kube-dashboard
    this.addManifestFromUrl('kubernetes-dashboard', 'https://raw.githubusercontent.com/kubernetes/dashboard/v2.0.5/aio/deploy/recommended.yaml');

    // Add service account for dashboard
    this.cluster.addManifest('eks-admin', {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'eks-admin',
        namespace: 'kube-system',
      }
    });

    this.cluster.addManifest('eks-admin-clusterrolebinding', {
      apiVersion: 'rbac.authorization.k8s.io/v1beta1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: 'eks-admin',
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'cluster-admin',
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'eks-admin',
          namespace: 'kube-system',
        },
      ],
    });
  }

  exposeUsingNginx (name: string,
    annotations: any,
    domainNameForApp: string | undefined,
    urlPathForApp: string | undefined,
    pathType : string,
    serviceName: string,
    servicePort: number,
    namespace?: string) {
    const ingressManifest = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata:{
        name: name,
        namespace: namespace? namespace : 'default',
        annotations: annotations,
      },
      spec: {
        rules: [
          {
            host: domainNameForApp? domainNameForApp : undefined,
            http: {
              paths: [
                {
                  path: urlPathForApp? urlPathForApp : '/',
                  pathType: pathType,
                  backend: {
                    service: {
                      name: serviceName,
                      port: {
                        number: servicePort,
                      }
                    }
                  },
                }
              ]
            },      
          }
        ]
      },
    };
    this.cluster.addManifest(name, ingressManifest);
  }

  deployKibanaDashboard(exposeUsingIngress: boolean, domainName?: string) {

    this.cluster.addManifest('kube-logging', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: 'kube-logging' }
    });

  // elasticsearch helm chart
    this.cluster.addHelmChart('elasticsearch', {
      repository: 'https://helm.elastic.co',
      chart: 'elasticsearch',
      release: 'elasticsearch',
      namespace: 'kube-logging',
      values: {
        'esJavaOpts': '-Xms512m -Xmx512m',
        'extraInitContainers': [
          {
            'name': 'fix-permissions',
            'image': 'busybox',
            'command': ["sh", "-c", "chown -R 1000:1000 /usr/share/elasticsearch/data"],
            'securityContext': {
              'runAsUser': 0,
              'privileged': true
            },  
            'volumeMounts': [
              {
                'name': 'elasticsearch',
                'mountPath': '/usr/share/elasticsearch/data'
              },
            ],
          },
          {
            'name': 'increase-fd-ulimit',
            'image': 'busybox',
            'command': ["sh", "-c", "ulimit -n 65536"],
            'securityContext': {
              'runAsUser': 0,
              'privileged': true            
            }
          }
        ],
        'volumeClaimTemplate': 
        {
          'accessModes': [ "ReadWriteOnce" ],
          'storageClassName': 'gp2',
          'resources': 
          {
            'requests':
            {
              'storage': '10Gi'
            },              
          },            
        },
        'fullnameOverride': 'elasticsearch',
        'terminationGracePeriod': 30
      }
    });

  // kibana helm chart
    this.cluster.addHelmChart('kibana', {
      repository: 'https://helm.elastic.co',
      chart: 'kibana',
      release: 'kibana',
      namespace: 'kube-logging',
      values: {
        'elasticsearchHosts': 'http://elasticsearch:9200',
        'elasticsearchURL': 'http://elasticsearch:9200',
        'replicas': 1,
        'healthCheckPath': '/kibana/api/status',
        'resources': {
          'requests': {
            'cpu': '100m'
          },
          'limits': {
            'cpu': '1000m'
          }
        },
        'extraEnvs': [
          {
            'name': 'SERVER_BASEPATH',
            'value': '/kibana'
          },
          {
            'name': 'SERVER_REWRITEBASEPATH',
            'value': "true"
          }
        ],
        'ingress': {
          'enabled': exposeUsingIngress,
          'annotations': {
            'kubernetes.io/ingress.class': 'nginx',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
            'nginx.ingress.kubernetes.io/configuration-snippet': 'rewrite ^/(.*)$ /$1 break;\n',
            'nginx.ingress.kubernetes.io/rewrite-target': '/'
          },
          'hosts': [
            {
              'host': domainName? domainName : undefined,
              'paths': [
                {
                  'path': '/kibana'
                }
              ]
            }
          ]
        }
      }
    });
  
  // fluentd helm chart
    this.cluster.addHelmChart('fluentd', {
      repository: 'https://fluent.github.io/helm-charts',
      chart: 'fluentd',
      release: 'fluentd',
      namespace: 'kube-logging',
      values: {
        "tolerations": [
          {
            "key": "node-role.kubernetes.io/master",
            "effect": "NoSchedule"
          }
        ],
        "env": [
          {
            "name": "FLUENT_ELASTICSEARCH_HOST",
            "value": "elasticsearch.kube-logging.svc.cluster.local"
          },
          {
            "name": "FLUENT_ELASTICSEARCH_PORT",
            "value": "9200"
          },
          {
            "name": "FLUENT_ELASTICSEARCH_SCHEME",
            "value": "http"
          },
          {
            "name": "FLUENTD_SYSTEMD_CONF",
            "value": "disable"
          }
        ],
        "resources": {
          "limits": {
            "memory": "512Mi"
          },
          "requests": {
            "cpu": "100m",
            "memory": "200Mi"
          }
        },
        "volumes": [
          {
            "name": "varlog",
            "hostPath": {
              "path": "/var/log"
            }
          },
          {
            "name": "varlibdockercontainers",
            "hostPath": {
              "path": "/var/lib/docker/containers"
            }
          }
        ],
        "volumeMounts": [
          {
            "name": "varlog",
            "mountPath": "/var/log"
          },
          {
            "name": "varlibdockercontainers",
            "mountPath": "/var/lib/docker/containers",
            "readOnly": true
          }
        ],
        "dashboards": {
          "enabled": false
        }
      }
    });
  }
}