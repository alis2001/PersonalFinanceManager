import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class RapilotInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Configuration
    const domainName = 'rapilot.com'; // Replace with your actual domain
    const subdomainApi = `api.${domainName}`;
    const subdomainApp = `app.${domainName}`;

    // VPC - Foundation for all Rapilot services
    const vpc = new ec2.Vpc(this, 'RapilotVPC', {
      maxAzs: 3,
      natGateways: 2,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'rapilot-public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'rapilot-private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'rapilot-database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });

    // VPC Endpoints for security and cost optimization
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    vpc.addInterfaceEndpoint('ECREndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    });

    vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    // Security Groups
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: vpc,
      description: 'Security group for Aurora PostgreSQL cluster',
      allowAllOutbound: false
    });

    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: vpc,
      description: 'Security group for Redis cluster',
      allowAllOutbound: false
    });

    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: vpc,
      description: 'Security group for ECS services',
      allowAllOutbound: true
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true
    });

    // ALB security group rules
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    // ECS can receive traffic from ALB
    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(3000), 'Node.js services');
    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8000), 'Python analytics');
    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8080), 'C++ engines');

    // Database access from ECS
    databaseSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL from ECS');
    redisSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(6379), 'Redis from ECS');

    // Secrets Manager for database credentials
    const dbSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      description: 'Rapilot database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'rapilot_admin' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\'
      }
    });

    // Aurora PostgreSQL Cluster
    const dbCluster = new rds.DatabaseCluster(this, 'RapilotDatabase', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4
      }),
      writer: rds.ClusterInstance.provisioned('writer', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE),
      }),
      readers: [
        rds.ClusterInstance.provisioned('reader', {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE),
        })
      ],
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromSecret(dbSecret),
      defaultDatabaseName: 'rapilot_finance',
      securityGroups: [databaseSecurityGroup],
      backup: {
        retention: cdk.Duration.days(30),
        preferredWindow: '03:00-04:00'
      },
      deletionProtection: true,
      storageEncrypted: true,
      monitoringInterval: cdk.Duration.seconds(60),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT
    });

    // Redis Subnet Group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds
    });

    // Redis Cluster
    const redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: 'Rapilot Redis cluster',
      cacheNodeType: 'cache.r6g.large',
      engine: 'redis',
      engineVersion: '7.0',
      numCacheClusters: 2,
      automaticFailoverEnabled: true,
      multiAzEnabled: true,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [redisSecurityGroup.securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true
    });

    // ECS Cluster
    const ecsCluster = new ecs.Cluster(this, 'RapilotCluster', {
      vpc: vpc,
      clusterName: 'rapilot-cluster',
      containerInsights: true,
      enableFargateCapacityProviders: true
    });

    // CloudWatch Log Groups
    const logGroup = new logs.LogGroup(this, 'RapilotLogGroup', {
      logGroupName: '/rapilot/ecs',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // IAM Role for ECS Tasks
    const ecsTaskRole = new iam.Role(this, 'ECSTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });

    // Grant access to secrets and parameter store
    dbSecret.grantRead(ecsTaskRole);
    ecsTaskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath'
      ],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/rapilot/*`]
    }));

    // SQS Queues (replacing RabbitMQ)
    const expenseQueue = new sqs.Queue(this, 'ExpenseQueue', {
      queueName: 'rapilot-expense-queue',
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'ExpenseDeadLetterQueue', {
          queueName: 'rapilot-expense-dlq'
        }),
        maxReceiveCount: 3
      },
      encryption: sqs.QueueEncryption.SQS_MANAGED
    });

    const incomeQueue = new sqs.Queue(this, 'IncomeQueue', {
      queueName: 'rapilot-income-queue',
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'IncomeDeadLetterQueue', {
          queueName: 'rapilot-income-dlq'
        }),
        maxReceiveCount: 3
      },
      encryption: sqs.QueueEncryption.SQS_MANAGED
    });

    // SNS Topics for notifications
    const notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: 'rapilot-notifications'
    });

    // ECR Repositories
    const services = ['gateway', 'auth', 'expense', 'income', 'category', 
                     'analytics', 'analytics-engine', 'reporting-engine', 'ml-engine'];
    
    const ecrRepositories: { [key: string]: ecr.Repository } = {};
    
    services.forEach(serviceName => {
      ecrRepositories[serviceName] = new ecr.Repository(this, `${serviceName}Repository`, {
        repositoryName: `rapilot/${serviceName}`,
        lifecycleRules: [{
          maxImageCount: 10,
          tagStatus: ecr.TagStatus.ANY
        }],
        imageScanOnPush: true
      });
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'RapilotALB', {
      vpc: vpc,
      internetFacing: true,
      loadBalancerName: 'rapilot-alb',
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: albSecurityGroup
    });

    // SSL Certificate (uncomment when you have a domain)
    // const certificate = new certificatemanager.Certificate(this, 'Certificate', {
    //   domainName: domainName,
    //   subjectAlternativeNames: [`*.${domainName}`],
    //   validation: certificatemanager.CertificateValidation.fromDns()
    // });

    // ALB Listeners
    const httpListener = alb.addListener('HttpListener', {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'Rapilot API is running'
      })
    });

    // Target Groups for each service
    const targetGroups: { [key: string]: elbv2.ApplicationTargetGroup } = {};
    
    const nodeServices = ['auth', 'expense', 'income', 'category'];
    nodeServices.forEach(serviceName => {
      targetGroups[serviceName] = new elbv2.ApplicationTargetGroup(this, `${serviceName}TargetGroup`, {
        vpc: vpc,
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: '/health',
          protocol: elbv2.Protocol.HTTP,
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3,
          timeout: cdk.Duration.seconds(10),
          interval: cdk.Duration.seconds(30)
        }
      });
    });

    // Analytics service target group (Python - port 8000)
    targetGroups['analytics'] = new elbv2.ApplicationTargetGroup(this, 'AnalyticsTargetGroup', {
      vpc: vpc,
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        protocol: elbv2.Protocol.HTTP
      }
    });

    // C++ engines target groups (port 8080)
    const cppEngines = ['analytics-engine', 'reporting-engine', 'ml-engine'];
    cppEngines.forEach(engineName => {
      targetGroups[engineName] = new elbv2.ApplicationTargetGroup(this, `${engineName}TargetGroup`, {
        vpc: vpc,
        port: 8080,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: '/health',
          protocol: elbv2.Protocol.HTTP
        }
      });
    });

    // ALB Routing Rules (replacing your gateway service)
    httpListener.addTargetGroups('AuthRule', {
      targetGroups: [targetGroups['auth']],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/auth/*'])],
      priority: 100
    });

    httpListener.addTargetGroups('ExpenseRule', {
      targetGroups: [targetGroups['expense']],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/expenses/*'])],
      priority: 200
    });

    httpListener.addTargetGroups('IncomeRule', {
      targetGroups: [targetGroups['income']],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/income/*'])],
      priority: 300
    });

    httpListener.addTargetGroups('CategoryRule', {
      targetGroups: [targetGroups['category']],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/categories/*'])],
      priority: 400
    });

    httpListener.addTargetGroups('AnalyticsRule', {
      targetGroups: [targetGroups['analytics']],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/analytics/*'])],
      priority: 500
    });

    // ECS Task Definitions and Services
    const taskDefinitions: { [key: string]: ecs.FargateTaskDefinition } = {};
    const ecsServices: { [key: string]: ecs.FargateService } = {};

    // Node.js services
    nodeServices.forEach(serviceName => {
      const taskDef = new ecs.FargateTaskDefinition(this, `${serviceName}TaskDef`, {
        memoryLimitMiB: 1024,
        cpu: 512,
        taskRole: ecsTaskRole,
        executionRole: ecsTaskRole
      });

      taskDef.addContainer(`${serviceName}Container`, {
        image: ecs.ContainerImage.fromEcrRepository(ecrRepositories[serviceName], 'latest'),
        containerName: serviceName,
        portMappings: [{ containerPort: 3000 }],
        logging: ecs.LogDrivers.awsLogs({
          logGroup: logGroup,
          streamPrefix: serviceName
        }),
        environment: {
          NODE_ENV: 'production',
          DB_HOST: dbCluster.clusterEndpoint.hostname,
          DB_PORT: '5432',
          DB_NAME: 'rapilot_finance',
          REDIS_HOST: redisCluster.attrPrimaryEndPointAddress,
          REDIS_PORT: '6379'
        },
        secrets: {
          DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
          DB_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username')
        }
      });

      taskDefinitions[serviceName] = taskDef;

      const service = new ecs.FargateService(this, `${serviceName}Service`, {
        cluster: ecsCluster,
        taskDefinition: taskDef,
        serviceName: `rapilot-${serviceName}`,
        desiredCount: 2,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [ecsSecurityGroup],
        enableExecuteCommand: true,
        capacityProviderStrategies: [{
          capacityProvider: 'FARGATE',
          weight: 1
        }]
      });

      // Auto Scaling
      const scaling = service.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10
      });

      scaling.scaleOnCpuUtilization(`${serviceName}CpuScaling`, {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(300)
      });

      scaling.scaleOnMemoryUtilization(`${serviceName}MemoryScaling`, {
        targetUtilizationPercent: 80
      });

      // Attach to target group
      service.attachToApplicationTargetGroup(targetGroups[serviceName]);
      
      ecsServices[serviceName] = service;
    });

    // Python Analytics Service
    const analyticsTaskDef = new ecs.FargateTaskDefinition(this, 'AnalyticsTaskDef', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: ecsTaskRole,
      executionRole: ecsTaskRole
    });

    analyticsTaskDef.addContainer('AnalyticsContainer', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepositories['analytics'], 'latest'),
      containerName: 'analytics',
      portMappings: [{ containerPort: 8000 }],
      logging: ecs.LogDrivers.awsLogs({
        logGroup: logGroup,
        streamPrefix: 'analytics'
      }),
      environment: {
        PYTHON_ENV: 'production',
        DB_HOST: dbCluster.clusterEndpoint.hostname,
        DB_PORT: '5432',
        DB_NAME: 'rapilot_finance',
        REDIS_HOST: redisCluster.attrPrimaryEndPointAddress,
        REDIS_PORT: '6379'
      },
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        DB_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username')
      }
    });

    const analyticsService = new ecs.FargateService(this, 'AnalyticsService', {
      cluster: ecsCluster,
      taskDefinition: analyticsTaskDef,
      serviceName: 'rapilot-analytics',
      desiredCount: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [ecsSecurityGroup],
      enableExecuteCommand: true
    });

    analyticsService.attachToApplicationTargetGroup(targetGroups['analytics']);

    // C++ Engines
    cppEngines.forEach(engineName => {
      const taskDef = new ecs.FargateTaskDefinition(this, `${engineName}TaskDef`, {
        memoryLimitMiB: 4096,
        cpu: 2048,
        taskRole: ecsTaskRole,
        executionRole: ecsTaskRole
      });

      taskDef.addContainer(`${engineName}Container`, {
        image: ecs.ContainerImage.fromEcrRepository(ecrRepositories[engineName], 'latest'),
        containerName: engineName,
        portMappings: [{ containerPort: 8080 }],
        logging: ecs.LogDrivers.awsLogs({
          logGroup: logGroup,
          streamPrefix: engineName
        }),
        environment: {
          DB_HOST: dbCluster.clusterEndpoint.hostname,
          DB_PORT: '5432',
          DB_NAME: 'rapilot_finance'
        },
        secrets: {
          DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
          DB_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username')
        }
      });

      const service = new ecs.FargateService(this, `${engineName}Service`, {
        cluster: ecsCluster,
        taskDefinition: taskDef,
        serviceName: `rapilot-${engineName}`,
        desiredCount: 1,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [ecsSecurityGroup]
      });

      service.attachToApplicationTargetGroup(targetGroups[engineName]);
    });

    // S3 Bucket for React Frontend
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `rapilot-frontend-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED
    });

    // Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'Rapilot Frontend OAI'
    });

    frontendBucket.grantRead(originAccessIdentity);

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity: originAccessIdentity
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.LoadBalancerV2Origin(alb, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER
        }
      },
      defaultRootObject: 'index.html',
      errorResponses: [{
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html'
      }],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100
    });

    // WAF for security
    const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet'
            }
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric'
          }
        }
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RapilotWebACL'
      }
    });

    // Associate WAF with ALB
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      resourceArn: alb.loadBalancerArn,
      webAclArn: webAcl.attrArn
    });

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'RapilotDashboard', {
      dashboardName: 'Rapilot-Production-Metrics'
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB Request Count',
        left: [alb.metricRequestCount()],
        width: 12
      }),
      new cloudwatch.GraphWidget({
        title: 'Database CPU Utilization',
        left: [dbCluster.metricCPUUtilization()],
        width: 12
      })
    );

    // Parameter Store for configuration
    new ssm.StringParameter(this, 'DBEndpoint', {
      parameterName: '/rapilot/database/endpoint',
      stringValue: dbCluster.clusterEndpoint.hostname
    });

    new ssm.StringParameter(this, 'RedisEndpoint', {
      parameterName: '/rapilot/redis/endpoint',
      stringValue: redisCluster.attrPrimaryEndPointAddress
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name'
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution URL'
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: dbCluster.clusterEndpoint.hostname,
      description: 'Aurora PostgreSQL cluster endpoint'
    });

    // Tags for all resources
    cdk.Tags.of(this).add('Project', 'Rapilot');
    cdk.Tags.of(this).add('Environment', 'Production');
    cdk.Tags.of(this).add('CostCenter', 'Engineering');
  }
}