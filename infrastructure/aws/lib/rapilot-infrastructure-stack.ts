import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';

export class RapilotInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext('environment') || 'production';
    
    // Service list for ECR repositories
    const services = [
      'gateway', 'auth', 'expense', 'income', 'category', 
      'analytics', 'analytics-engine', 'reporting-engine', 'ml-engine'
    ];

    // ==========================================
    // VPC - MULTI-AZ PRODUCTION SETUP
    // ==========================================
    
    const vpc = new ec2.Vpc(this, 'FinanceVPC', {
      maxAzs: 3,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      natGateways: 3,
    });

    // ==========================================
    // SECURITY GROUPS
    // ==========================================

    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc,
      description: 'Security group for ECS services',
      allowAllOutbound: true,
    });
    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.allTcp(), 'ALB to ECS');
    ecsSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.allTcp(), 'ECS inter-service');

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for databases',
      allowAllOutbound: false,
    });
    dbSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL');
    dbSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(6379), 'Redis');

    // ==========================================
    // SECRETS MANAGEMENT
    // ==========================================

    const dbCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      description: 'Aurora PostgreSQL master credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'financeadmin' }),
        generateStringKey: 'password',
        passwordLength: 32,
        excludeCharacters: '"@/\\\'',
      },
    });

    const jwtSecret = new secretsmanager.Secret(this, 'JWTSecret', {
      description: 'JWT secret for authentication',
      generateSecretString: {
        passwordLength: 64,
        excludeCharacters: '"@/\\\'',
      },
    });

    // ==========================================
    // AURORA POSTGRESQL SERVERLESS V2
    // ==========================================

    const dbSubnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      description: 'Subnet group for Aurora PostgreSQL',
    });

    const auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 16,
      credentials: rds.Credentials.fromSecret(dbCredentials),
      defaultDatabaseName: 'financetracker',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      subnetGroup: dbSubnetGroup,
      backup: {
        retention: cdk.Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      deletionProtection: environment === 'production',
      storageEncrypted: true,
      monitoringInterval: cdk.Duration.minutes(1),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      cloudwatchLogsExports: ['postgresql'],
      removalPolicy: environment === 'production' ? cdk.RemovalPolicy.SNAPSHOT : cdk.RemovalPolicy.DESTROY,
    });

    // ==========================================
    // ELASTICACHE REDIS CLUSTER
    // ==========================================

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
    });

    const redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: 'Redis cluster for Finance Tracker caching',
      replicationGroupId: 'finance-redis',
      numCacheClusters: 3,
      cacheNodeType: 'cache.r7g.large',
      engine: 'redis',
      engineVersion: '7.0',
      port: 6379,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [dbSecurityGroup.securityGroupId],
      automaticFailoverEnabled: true,
      multiAzEnabled: true,
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      snapshotRetentionLimit: 5,
      snapshotWindow: '03:00-05:00',
      preferredMaintenanceWindow: 'sun:05:00-sun:07:00',
    });

    // ==========================================
    // ECR REPOSITORIES
    // ==========================================

    const repositories: { [key: string]: ecr.Repository } = {};
    services.forEach(service => {
      repositories[service] = new ecr.Repository(this, `${service}Repository`, {
        repositoryName: `finance-tracker/${service}`,
        imageScanOnPush: true,
        lifecycleRules: [
          {
            maxImageCount: 10,
            tagStatus: ecr.TagStatus.UNTAGGED,
          },
          {
            maxImageAge: cdk.Duration.days(30),
            tagStatus: ecr.TagStatus.ANY,
          },
        ],
      });
    });

    // ==========================================
    // ECS CLUSTERS
    // ==========================================

    const fargateCluster = new ecs.Cluster(this, 'FargateCluster', {
      vpc,
      clusterName: 'finance-fargate-cluster',
      containerInsights: true,
    });

    const ec2Cluster = new ecs.Cluster(this, 'EC2Cluster', {
      vpc,
      clusterName: 'finance-ec2-cluster',
      containerInsights: true,
    });

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ECSAutoScalingGroup', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6I, ec2.InstanceSize.LARGE),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      minCapacity: 1,
      maxCapacity: 10,
      desiredCapacity: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroup: ecsSecurityGroup,
    });

    const capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup,
      enableManagedScaling: true,
      targetCapacityPercent: 80,
    });
    ec2Cluster.addAsgCapacityProvider(capacityProvider);

    // ==========================================
    // TASK EXECUTION ROLE
    // ==========================================

    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    dbCredentials.grantRead(taskExecutionRole);
    jwtSecret.grantRead(taskExecutionRole);

    // ==========================================
    // APPLICATION LOAD BALANCER
    // ==========================================

    const alb = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const defaultTargetGroup = new elbv2.ApplicationTargetGroup(this, 'DefaultTargetGroup', {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
        timeout: cdk.Duration.seconds(30),
        interval: cdk.Duration.seconds(60),
      },
    });

    const httpListener = alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [defaultTargetGroup],
    });

    // ==========================================
    // MESSAGE QUEUES
    // ==========================================

    const deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: 'finance-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const expenseQueue = new sqs.Queue(this, 'ExpenseQueue', {
      queueName: 'expense-processing',
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const incomeQueue = new sqs.Queue(this, 'IncomeQueue', {
      queueName: 'income-processing',
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const notificationsTopic = new sns.Topic(this, 'NotificationsTopic', {
      topicName: 'finance-notifications',
    });

    // ==========================================
    // S3 + CLOUDFRONT FOR FRONTEND
    // ==========================================

    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `finance-tracker-frontend-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'Finance Tracker Frontend OAI',
    });

    frontendBucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'FrontendDistribution', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: frontendBucket,
            originAccessIdentity,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              compress: true,
              allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
              cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
              viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
          ],
        },
        {
          customOriginSource: {
            domainName: alb.loadBalancerDnsName,
            httpPort: 80,
            originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          },
          behaviors: [
            {
              pathPattern: '/api/*',
              allowedMethods: cloudfront.CloudFrontAllowedMethods.ALL,
              viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
              cachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // CachingDisabled
              originRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf', // CORS-S3Origin
            },
          ],
        },
      ],
      errorConfigurations: [
        {
          errorCode: 404,
          responseCode: 200,
          responsePagePath: '/index.html',
          errorCachingMinTtl: 300,
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // ==========================================
    // CLOUDWATCH LOG GROUPS
    // ==========================================

    services.forEach(service => {
      new logs.LogGroup(this, `${service}LogGroup`, {
        logGroupName: `/ecs/finance-tracker/${service}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });

    // ==========================================
    // OUTPUTS
    // ==========================================

    new cdk.CfnOutput(this, 'VPCId', {
      value: vpc.vpcId,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: auroraCluster.clusterEndpoint.hostname,
      description: 'Aurora PostgreSQL Cluster Endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseReaderEndpoint', {
      value: auroraCluster.clusterReadEndpoint.hostname,
      description: 'Aurora PostgreSQL Reader Endpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: redisCluster.attrPrimaryEndPointAddress,
      description: 'Redis Cluster Primary Endpoint',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'FargateClusterName', {
      value: fargateCluster.clusterName,
      description: 'ECS Fargate Cluster Name',
    });

    new cdk.CfnOutput(this, 'EC2ClusterName', {
      value: ec2Cluster.clusterName,
      description: 'ECS EC2 Cluster Name',
    });

    new cdk.CfnOutput(this, 'ECRRepositories', {
      value: Object.keys(repositories).map(key => repositories[key].repositoryUri).join(','),
      description: 'ECR Repository URIs',
    });

    new cdk.CfnOutput(this, 'ExpenseQueueURL', {
      value: expenseQueue.queueUrl,
      description: 'Expense Processing Queue URL',
    });

    new cdk.CfnOutput(this, 'IncomeQueueURL', {
      value: incomeQueue.queueUrl,
      description: 'Income Processing Queue URL',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: frontendBucket.bucketName,
      description: 'Frontend S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretARN', {
      value: dbCredentials.secretArn,
      description: 'Database Credentials Secret ARN',
    });

    new cdk.CfnOutput(this, 'JWTSecretARN', {
      value: jwtSecret.secretArn,
      description: 'JWT Secret ARN',
    });
  }
}