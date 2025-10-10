import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';

export class RapilotInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC Configuration - VERIFIED FOR MILAN
    const vpc = new ec2.Vpc(this, 'FinanceVPC', {
      maxAzs: 3, // Milan has 3 AZs: eu-south-1a, eu-south-1b, eu-south-1c
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
      natGateways: 1, // Cost optimization
    });

    // VPC Endpoints for cost optimization
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3
    });

    vpc.addInterfaceEndpoint('ECREndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR
    });

    vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER
    });

    vpc.addInterfaceEndpoint('LogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
    });

    // ECS Cluster - VERIFIED FOR MILAN  
    const cluster = new ecs.Cluster(this, 'FinanceCluster', {
      vpc,
      clusterName: 'finance-tracker-cluster',
      containerInsights: false, // CRITICAL: Not available in eu-south-1
      enableFargateCapacityProviders: true,
    });

    // Database credentials
    const dbCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      description: 'PostgreSQL master credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'financeadmin' }),
        generateStringKey: 'password',
        passwordLength: 32,
        excludeCharacters: '"@/\\\'',
      },
    });

    // Database subnet group
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      description: 'Subnet group for PostgreSQL',
    });

    // Database security group
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for databases',
      allowAllOutbound: false,
    });

    // PostgreSQL Database - FIXED VERSION FOR MILAN
    const database = new rds.DatabaseInstance(this, 'PostgreSQLDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14_13, // VERIFIED: Available in eu-south-1
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'financetracker',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      subnetGroup: dbSubnetGroup,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: false,
      storageEncrypted: false, // Free tier limitation
      allocatedStorage: 20, // Free tier limit
      maxAllocatedStorage: 100,
      autoMinorVersionUpgrade: true,
      enablePerformanceInsights: false, // Not available in free tier
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      monitoringInterval: cdk.Duration.seconds(60),
    });

    // Redis subnet group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: 'finance-redis-subnet-group',
    });

    // Redis security group
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      description: 'Security group for Redis cluster',
      allowAllOutbound: false,
    });

    // Redis Cluster - FIXED VERSION FOR MILAN
    const redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: 'cache.t3.micro', // Free tier verified
      engine: 'redis',
      engineVersion: '6.2', // VERIFIED: Stable version for eu-south-1
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      port: 6379,
    });

    redisCluster.addDependency(redisSubnetGroup);

    // S3 Bucket for frontend assets
    const assetsBucket = new s3.Bucket(this, 'FrontendAssets', {
      bucketName: `finance-tracker-assets-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLB', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'finance-tracker-alb',
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC
      })
    });

    // ALB Security Group
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(alb.loadBalancerDnsName),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        }
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      comment: 'Finance Tracker CDN Distribution',
      enabled: true,
    });

    // ECR Repositories for microservices
    const ecrRepositories: { [key: string]: ecr.Repository } = {};
    const services = ['gateway', 'auth', 'expense', 'income', 'category', 'analytics', 'analytics-engine', 'reporting-engine', 'ml-engine'];
    
    services.forEach(service => {
      ecrRepositories[service] = new ecr.Repository(this, `${service}Repository`, {
        repositoryName: `finance-tracker/${service}`,
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.MUTABLE,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        lifecycleRules: [{
          maxImageCount: 10, // Keep only 10 latest images
        }],
      });
    });

    // Task execution role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: 'finance-tracker-task-execution-role',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ],
    });

    // Add specific permissions for secrets and logs
    taskExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret'
      ],
      resources: [
        dbCredentials.secretArn,
        `${dbCredentials.secretArn}*`
      ]
    }));

    // Task role for application permissions
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: 'finance-tracker-task-role',
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'FinanceTrackerLogs', {
      logGroupName: '/aws/ecs/finance-tracker',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Gateway Task Definition
    const gatewayTaskDefinition = new ecs.FargateTaskDefinition(this, 'GatewayTaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      family: 'finance-tracker-gateway',
    });

    gatewayTaskDefinition.addContainer('gateway', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepositories['gateway'], 'latest'),
      memoryLimitMiB: 512,
      cpu: 256,
      essential: true,
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'gateway',
        logGroup: logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        AUTH_SERVICE_URL: 'http://finance-tracker-auth.finance-tracker-cluster.local:3000',
        EXPENSE_SERVICE_URL: 'http://finance-tracker-expense.finance-tracker-cluster.local:3000',
        INCOME_SERVICE_URL: 'http://finance-tracker-income.finance-tracker-cluster.local:3000',
        CATEGORY_SERVICE_URL: 'http://finance-tracker-category.finance-tracker-cluster.local:3000',
        ANALYTICS_ENGINE_URL: 'http://finance-tracker-analytics-engine.finance-tracker-cluster.local:8080',
        REPORTING_ENGINE_URL: 'http://finance-tracker-reporting.finance-tracker-cluster.local:8080',
        ML_ENGINE_URL: 'http://finance-tracker-ml.finance-tracker-cluster.local:8080',
        ENABLE_CORS: 'true',
        RATE_LIMIT_WINDOW: '900000',
        RATE_LIMIT_MAX_REQUESTS: '100',
        LOG_LEVEL: 'info',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Auth Task Definition
    const authTaskDefinition = new ecs.FargateTaskDefinition(this, 'AuthTaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      family: 'finance-tracker-auth',
    });

    authTaskDefinition.addContainer('auth', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepositories['auth'], 'latest'),
      memoryLimitMiB: 512,
      cpu: 256,
      essential: true,
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'auth',
        logGroup: logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        DB_HOST: database.instanceEndpoint.hostname,
        DB_PORT: '5432',
        DB_NAME: 'financetracker',
        REDIS_HOST: redisCluster.attrRedisEndpointAddress,
        REDIS_PORT: '6379',
        JWT_SECRET: 'your-jwt-secret-change-in-production',
        JWT_EXPIRY: '1h',
        BCRYPT_ROUNDS: '12',
        SESSION_TIMEOUT: '15552000000', // 180 days - BANKING APP PATTERN for mobile
        REFRESH_TOKEN_EXPIRY: '180d', // Matches SESSION_TIMEOUT
        LOG_LEVEL: 'info',
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Expense Task Definition
    const expenseTaskDefinition = new ecs.FargateTaskDefinition(this, 'ExpenseTaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      family: 'finance-tracker-expense',
    });

    expenseTaskDefinition.addContainer('expense', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepositories['expense'], 'latest'),
      memoryLimitMiB: 512,
      cpu: 256,
      essential: true,
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'expense',
        logGroup: logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        DB_HOST: database.instanceEndpoint.hostname,
        DB_PORT: '5432',
        DB_NAME: 'financetracker',
        RABBITMQ_HOST: 'rabbitmq', // This will need to be updated when RabbitMQ is deployed
        RABBITMQ_PORT: '5672',
        AUTH_SERVICE_URL: 'http://finance-tracker-auth.finance-tracker-cluster.local:3000',
        LOG_LEVEL: 'info',
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Income Task Definition
    const incomeTaskDefinition = new ecs.FargateTaskDefinition(this, 'IncomeTaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      family: 'finance-tracker-income',
    });

    incomeTaskDefinition.addContainer('income', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepositories['income'], 'latest'),
      memoryLimitMiB: 512,
      cpu: 256,
      essential: true,
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'income',
        logGroup: logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        DB_HOST: database.instanceEndpoint.hostname,
        DB_PORT: '5432',
        DB_NAME: 'financetracker',
        RABBITMQ_HOST: 'rabbitmq', // This will need to be updated when RabbitMQ is deployed
        RABBITMQ_PORT: '5672',
        AUTH_SERVICE_URL: 'http://finance-tracker-auth.finance-tracker-cluster.local:3000',
        LOG_LEVEL: 'info',
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Category Task Definition
    const categoryTaskDefinition = new ecs.FargateTaskDefinition(this, 'CategoryTaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      family: 'finance-tracker-category',
    });

    categoryTaskDefinition.addContainer('category', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepositories['category'], 'latest'),
      memoryLimitMiB: 512,
      cpu: 256,
      essential: true,
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'category',
        logGroup: logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        DB_HOST: database.instanceEndpoint.hostname,
        DB_PORT: '5432',
        DB_NAME: 'financetracker',
        AUTH_SERVICE_URL: 'http://finance-tracker-auth.finance-tracker-cluster.local:3000',
        LOG_LEVEL: 'info',
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Analytics Task Definition (Python)
    const analyticsTaskDefinition = new ecs.FargateTaskDefinition(this, 'AnalyticsTaskDefinition', {
      memoryLimitMiB: 1024,
      cpu: 512,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      family: 'finance-tracker-analytics',
    });

    analyticsTaskDefinition.addContainer('analytics', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepositories['analytics'], 'latest'),
      memoryLimitMiB: 1024,
      cpu: 512,
      essential: true,
      portMappings: [{ containerPort: 8000, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'analytics',
        logGroup: logGroup,
      }),
      environment: {
        PYTHON_ENV: 'production',
        APP_ENV: 'production',
        DB_HOST: database.instanceEndpoint.hostname,
        DB_PORT: '5432',
        DB_NAME: 'financetracker',
        REDIS_HOST: redisCluster.attrRedisEndpointAddress,
        REDIS_PORT: '6379',
        LOG_LEVEL: 'INFO',
        JWT_SECRET: 'your-jwt-secret-change-in-production',
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ===================================================================
    // ECS SERVICES - SET DESIRED COUNT TO 0 INITIALLY
    // ===================================================================

    // Gateway Service
    const gatewayService = new ecs.FargateService(this, 'GatewayService', {
      cluster,
      taskDefinition: gatewayTaskDefinition,
      serviceName: 'finance-tracker-gateway',
      desiredCount: 0, // CHANGED: Start with 0 until images are available
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      enableExecuteCommand: true,
    });

    // Auth Service
    const authService = new ecs.FargateService(this, 'AuthService', {
      cluster,
      taskDefinition: authTaskDefinition,
      serviceName: 'finance-tracker-auth',
      desiredCount: 0, // CHANGED: Start with 0 until images are available
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      enableExecuteCommand: true,
    });

    // Expense Service
    const expenseService = new ecs.FargateService(this, 'ExpenseService', {
      cluster,
      taskDefinition: expenseTaskDefinition,
      serviceName: 'finance-tracker-expense',
      desiredCount: 0, // CHANGED: Start with 0 until images are available
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      enableExecuteCommand: true,
    });

    // Income Service
    const incomeService = new ecs.FargateService(this, 'IncomeService', {
      cluster,
      taskDefinition: incomeTaskDefinition,
      serviceName: 'finance-tracker-income',
      desiredCount: 0, // CHANGED: Start with 0 until images are available
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      enableExecuteCommand: true,
    });

    // Category Service
    const categoryService = new ecs.FargateService(this, 'CategoryService', {
      cluster,
      taskDefinition: categoryTaskDefinition,
      serviceName: 'finance-tracker-category',
      desiredCount: 0, // CHANGED: Start with 0 until images are available
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      enableExecuteCommand: true,
    });

    // Analytics Service
    const analyticsService = new ecs.FargateService(this, 'AnalyticsService', {
      cluster,
      taskDefinition: analyticsTaskDefinition,
      serviceName: 'finance-tracker-analytics',
      desiredCount: 0, // CHANGED: Start with 0 until images are available
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }),
      enableExecuteCommand: true,
    });

    // ===================================================================
    // LOAD BALANCER TARGET GROUPS
    // ===================================================================

    // Gateway Target Group
    const gatewayTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GatewayTargetGroup', {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        enabled: true,
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        port: '3000',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 10,
        timeout: cdk.Duration.seconds(10),
        interval: cdk.Duration.seconds(30),
      },
    });

    gatewayService.attachToApplicationTargetGroup(gatewayTargetGroup);

    // Add listener to ALB
    alb.addListener('HttpListener', {
      port: 80,
      defaultTargetGroups: [gatewayTargetGroup],
    });

    // ===================================================================
    // AUTO SCALING - Keep existing configuration
    // ===================================================================

    // Gateway Auto-scaling
    const gatewayScalingTarget = gatewayService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    gatewayScalingTarget.scaleOnCpuUtilization('GatewayCpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    gatewayScalingTarget.scaleOnMemoryUtilization('GatewayMemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Auth Auto-scaling
    const authScalingTarget = authService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    authScalingTarget.scaleOnCpuUtilization('AuthCpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ===================================================================
    // SECURITY GROUP RULES
    // ===================================================================

    // Allow ECS services to access database
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from VPC'
    );

    // Allow ECS services to access Redis
    redisSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis access from VPC'
    );

    // Allow ALB to access ECS services
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      description: 'Security group for ECS services',
      allowAllOutbound: true,
    });

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
      ec2.Port.tcp(3000),
      'Allow ALB to access Node.js services'
    );

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
      ec2.Port.tcp(8000),
      'Allow ALB to access Python services'
    );

    // ===================================================================
    // CLOUDWATCH MONITORING
    // ===================================================================

    // Database CPU Alarm
    new cloudwatch.Alarm(this, 'DatabaseCPUAlarm', {
      metric: database.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Database CPU utilization is too high',
    });

    // Database Connection Alarm
    new cloudwatch.Alarm(this, 'DatabaseConnectionsAlarm', {
      metric: database.metricDatabaseConnections(),
      threshold: 15, // t3.micro supports ~20 connections
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Database connection count is too high',
    });

    // Gateway Service CPU Alarm
    new cloudwatch.Alarm(this, 'GatewayServiceCPUAlarm', {
      metric: gatewayService.metricCpuUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Gateway service CPU utilization is too high',
    });

    // ===================================================================
    // OUTPUTS
    // ===================================================================

    new cdk.CfnOutput(this, 'VPCId', {
      value: vpc.vpcId,
      exportName: 'FinanceTracker-VPC-ID',
      description: 'VPC ID for Finance Tracker',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      exportName: 'FinanceTracker-Cluster-Name',
      description: 'ECS Cluster name',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      exportName: 'FinanceTracker-DB-Endpoint',
      description: 'PostgreSQL database endpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: redisCluster.attrRedisEndpointAddress,
      exportName: 'FinanceTracker-Redis-Endpoint',
      description: 'Redis cluster endpoint',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      exportName: 'FinanceTracker-ALB-DNS',
      description: 'Application Load Balancer DNS name',
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      exportName: 'FinanceTracker-CloudFront-URL',
      description: 'CloudFront distribution URL',
    });

    new cdk.CfnOutput(this, 'ECRRepositories', {
      value: JSON.stringify(
        Object.keys(ecrRepositories).reduce((acc, key) => {
          acc[key] = ecrRepositories[key].repositoryUri;
          return acc;
        }, {} as { [key: string]: string })
      ),
      exportName: 'FinanceTracker-ECR-Repositories',
      description: 'ECR repository URIs for all services',
    });

    new cdk.CfnOutput(this, 'GatewayServiceArn', {
      value: gatewayService.serviceArn,
      exportName: 'FinanceTracker-Gateway-Service-ARN',
      description: 'Gateway ECS service ARN',
    });

    new cdk.CfnOutput(this, 'AuthServiceArn', {
      value: authService.serviceArn,
      exportName: 'FinanceTracker-Auth-Service-ARN',
      description: 'Auth ECS service ARN',
    });
  }
}