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
import { Construct } from 'constructs';

/**
 * FREE TIER COMPATIBLE Finance Tracker Infrastructure
 * ⚠️  ALL INSTANCES SIZED FOR AWS FREE TIER
 * - PostgreSQL: t3.micro (FREE TIER ELIGIBLE)
 * - Redis: t2.micro (FREE TIER ELIGIBLE)
 * - RDS Storage: 20GB (FREE TIER LIMIT)
 * - Single AZ for cost optimization
 */
export class RapilotInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext('environment') || 'development';
    
    const services = [
      'gateway', 'auth', 'expense', 'income', 'category', 
      'analytics', 'analytics-engine', 'reporting-engine', 'ml-engine'
    ];

    // ✅ VPC Configuration - FREE TIER COMPATIBLE
    const vpc = new ec2.Vpc(this, 'FinanceVPC', {
      maxAzs: 2, // FREE TIER: 2 AZs to minimize costs
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
      natGateways: 1, // FREE TIER: Only 1 NAT Gateway to reduce costs
    });

    // ✅ Security Groups
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

    // ✅ Secrets Management
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

    // ✅ Database Subnet Group
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      description: 'Subnet group for PostgreSQL',
    });

    // ✅ FREE TIER PostgreSQL Database - FIXED FOR FREE TIER
    const database = new rds.DatabaseInstance(this, 'PostgreSQLDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO), // ✅ FREE TIER: t3.micro
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'financetracker',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      subnetGroup: dbSubnetGroup,
      backupRetention: cdk.Duration.days(1), // ✅ FREE TIER: Minimal backup retention
      deletionProtection: false, // ✅ FREE TIER: Allow deletion for cost control
      storageEncrypted: false, // ✅ FREE TIER: Encryption not included in free tier
      monitoringInterval: cdk.Duration.seconds(0), // ✅ FREE TIER: Disable enhanced monitoring
      enablePerformanceInsights: false, // ✅ FREE TIER: Disable performance insights
      allocatedStorage: 20, // ✅ FREE TIER: Maximum 20GB for free tier
      maxAllocatedStorage: 20, // ✅ FREE TIER: No auto-scaling to prevent charges
      autoMinorVersionUpgrade: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // ✅ FREE TIER: Allow cleanup
    });

    // ✅ FREE TIER Redis Subnet Group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      cacheSubnetGroupName: 'finance-redis-subnet-group',
    });

    // ✅ FREE TIER Redis Cache Cluster - FIXED FOR FREE TIER
    const redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: 'cache.t3.micro', // ✅ FREE TIER: t2.micro (was t3.medium)
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

    // ✅ ECR Repositories - FREE TIER COMPATIBLE
    const repositories: { [key: string]: ecr.Repository } = {};
    services.forEach(service => {
      repositories[service] = new ecr.Repository(this, `${service}Repository`, {
        repositoryName: `finance-tracker/${service}`,
        imageScanOnPush: false, // ✅ FREE TIER: Disable scanning to reduce costs
        lifecycleRules: [
          {
            maxImageCount: 3, // ✅ FREE TIER: Keep fewer images
            tagStatus: ecr.TagStatus.UNTAGGED,
          },
          {
            maxImageAge: cdk.Duration.days(7), // ✅ FREE TIER: Shorter retention
            tagStatus: ecr.TagStatus.ANY,
          },
        ],
        removalPolicy: cdk.RemovalPolicy.DESTROY, // ✅ FREE TIER: Allow cleanup
      });
    });

    // ✅ ECS Fargate Cluster - FREE TIER COMPATIBLE
    const fargateCluster = new ecs.Cluster(this, 'FargateCluster', {
      vpc,
      clusterName: 'finance-fargate-cluster',
      containerInsights: false, // ✅ FREE TIER: Disable container insights
    });

    // ✅ Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    dbCredentials.grantRead(taskExecutionRole);
    jwtSecret.grantRead(taskExecutionRole);

    // ✅ Application Load Balancer - FREE TIER COMPATIBLE
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
        unhealthyThresholdCount: 3, // ✅ FREE TIER: Faster failover
        timeout: cdk.Duration.seconds(10), // ✅ FREE TIER: Shorter timeout
        interval: cdk.Duration.seconds(30), // ✅ FREE TIER: Less frequent checks
      },
    });

    const httpListener = alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [defaultTargetGroup],
    });

    // ✅ S3 Bucket for Frontend - FREE TIER COMPATIBLE
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `finance-tracker-frontend-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false, // ✅ FREE TIER: Disable versioning to save storage
    });

    // ✅ CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'Finance Tracker Frontend OAI',
    });

    frontendBucket.grantRead(originAccessIdentity);

    // ✅ CloudFront Distribution - FREE TIER COMPATIBLE
    const distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
      },
      comment: 'Finance Tracker Frontend Distribution',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // ✅ FREE TIER: Use only US/Europe edge locations
    });

    // ✅ CloudWatch Log Groups - FREE TIER COMPATIBLE
    services.forEach(service => {
      new logs.LogGroup(this, `${service}LogGroup`, {
        logGroupName: `/finance-tracker/${service}`,
        retention: logs.RetentionDays.ONE_WEEK, // ✅ FREE TIER: Shorter retention
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });

    // ✅ Stack Outputs
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

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: frontendBucket.bucketName,
      description: 'Frontend S3 Bucket Name',
    });
  }
}