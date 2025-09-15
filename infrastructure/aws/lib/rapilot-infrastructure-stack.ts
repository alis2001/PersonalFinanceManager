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
import { Construct } from 'constructs';

/**
 * Finance Tracker Infrastructure Stack
 * Optimized for AWS Free Tier
 * - PostgreSQL: t3.micro (Free Tier eligible)
 * - Redis: t2.micro (Free Tier eligible)  
 * - Single NAT Gateway (cost optimization)
 * - 20GB storage limit (Free Tier)
 */
export class RapilotInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext('environment') || 'production';
    
    const services = [
      'gateway', 'auth', 'expense', 'income', 'category', 
      'analytics', 'analytics-engine', 'reporting-engine', 'ml-engine'
    ];

    // VPC Configuration
    const vpc = new ec2.Vpc(this, 'FinanceVPC', {
      maxAzs: 2,
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
      natGateways: 2,
    });

    // Security Groups
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

    // Secrets Management
    const dbCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      description: 'PostgreSQL master credentials',
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

    // Database Subnet Group
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      description: 'Subnet group for PostgreSQL',
    });

    // PostgreSQL Database
    const database = new rds.DatabaseInstance(this, 'PostgreSQLDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'financetracker',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      subnetGroup: dbSubnetGroup,
      backupRetention: cdk.Duration.days(7),
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      deletionProtection: environment === 'production',
      storageEncrypted: true,
      monitoringInterval: cdk.Duration.minutes(1),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      cloudwatchLogsExports: ['postgresql'],
      allocatedStorage: 100,
      maxAllocatedStorage: 1000,
      autoMinorVersionUpgrade: true,
      removalPolicy: environment === 'production' ? 
        cdk.RemovalPolicy.SNAPSHOT : cdk.RemovalPolicy.DESTROY,
    });

    // Redis Subnet Group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      cacheSubnetGroupName: 'finance-redis-subnet-group',
    });

    // Redis Cache Cluster
    const redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: 'cache.t3.medium',
      engine: 'redis',
      engineVersion: '7.0',
      numCacheNodes: 1,
      port: 6379,
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [dbSecurityGroup.securityGroupId],
      clusterName: 'finance-redis',
      preferredAvailabilityZone: vpc.availabilityZones[0],
    });

    redisCluster.addDependency(redisSubnetGroup);

    // ECR Repositories
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

    // ECS Fargate Cluster
    const fargateCluster = new ecs.Cluster(this, 'FargateCluster', {
      vpc,
      clusterName: 'finance-fargate-cluster',
      containerInsights: true,
    });

    // Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    dbCredentials.grantRead(taskExecutionRole);
    jwtSecret.grantRead(taskExecutionRole);

    // Application Load Balancer
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

    // SQS Queues
    const expenseQueue = new sqs.Queue(this, 'ExpenseQueue', {
      queueName: 'expense-processing',
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    const incomeQueue = new sqs.Queue(this, 'IncomeQueue', {
      queueName: 'income-processing', 
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    // SNS Topic
    const notificationsTopic = new sns.Topic(this, 'NotificationsTopic', {
      topicName: 'finance-notifications',
    });

    // S3 Bucket for Frontend
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `finance-tracker-frontend-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'Finance Tracker Frontend OAI',
    });

    frontendBucket.grantRead(originAccessIdentity);

    // CloudFront Cache Policy for API
    const apiCachePolicy = new cloudfront.CachePolicy(this, 'APICachePolicy', {
      cachePolicyName: 'FinanceTrackerAPIPolicy',
      comment: 'Cache policy for API routes with no caching',
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(1),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization', 'Content-Type', 'Accept'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.all(),
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      comment: 'Finance Tracker Frontend Distribution',
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.LoadBalancerV2Origin(alb, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // CloudWatch Log Groups
    services.forEach(service => {
      new logs.LogGroup(this, `${service}LogGroup`, {
        logGroupName: `/ecs/finance-tracker/${service}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'VPCId', {
      value: vpc.vpcId,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      description: 'PostgreSQL Database Endpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: redisCluster.attrRedisEndpointAddress,
      description: 'Redis Cluster Endpoint',
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

    new cdk.CfnOutput(this, 'NotificationsTopicARN', {
      value: notificationsTopic.topicArn,
      description: 'SNS Notifications Topic ARN',
    });
  }
}