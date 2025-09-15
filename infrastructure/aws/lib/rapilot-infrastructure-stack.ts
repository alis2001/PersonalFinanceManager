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
import { Construct } from 'constructs';

export class RapilotInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC Configuration - FIXED for Milan region
    const vpc = new ec2.Vpc(this, 'FinanceVPC', {
      maxAzs: 3, // Milan has 3 AZs available
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

    // Add VPC endpoints to reduce NAT Gateway costs
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3
    });

    vpc.addInterfaceEndpoint('ECREndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR
    });

    vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER
    });

    // ECS Cluster - FIXED: Container Insights not available in eu-south-1
    const cluster = new ecs.Cluster(this, 'FinanceCluster', {
      vpc,
      containerInsights: false // CRITICAL: Not available in Milan region
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

    // PostgreSQL Database - FIXED: Using available version in Milan
    const database = new rds.DatabaseInstance(this, 'PostgreSQLDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_14, // FIXED: Available in eu-south-1
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'financetracker',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      subnetGroup: dbSubnetGroup,
      backupRetention: cdk.Duration.days(1),
      deletionProtection: false,
      storageEncrypted: false, // Free tier doesn't include encryption
      allocatedStorage: 20, // Free tier limit
      maxAllocatedStorage: 20,
      autoMinorVersionUpgrade: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Redis subnet group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    // Redis security group
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      description: 'Security group for Redis cluster',
      allowAllOutbound: false,
    });

    // Redis Cluster - FIXED configuration
    const redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: 'cache.t2.micro', // Free tier eligible
      engine: 'redis',
      engineVersion: '7.0',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
    });

    redisCluster.addDependency(redisSubnetGroup);

    // S3 Bucket for frontend assets
    const assetsBucket = new s3.Bucket(this, 'FrontendAssets', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLB', {
      vpc,
      internetFacing: true,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC
      })
    });

    // Default target group for ALB
    const defaultTargetGroup = new elbv2.ApplicationTargetGroup(this, 'DefaultTargetGroup', {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
    });

    // ALB Listener
    alb.addListener('DefaultListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [defaultTargetGroup],
    });

    // CloudFront Distribution - FIXED: Using modern S3Origin API
    const distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
      defaultBehavior: {
        // FIXED: Use S3BucketOrigin instead of deprecated S3Origin
        origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(alb.loadBalancerDnsName),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        }
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // ECR Repositories for microservices
    const services = ['gateway', 'auth', 'expense', 'income', 'category', 'analytics'];
    services.forEach(service => {
      new ecr.Repository(this, `${service}Repository`, {
        repositoryName: `finance-tracker-${service}`,
        imageScanOnPush: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });

    // Task execution role - FIXED: Proper permissions
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ],
    });

    // Add specific permissions to avoid policy size issues
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

    // Log group
    const logGroup = new logs.LogGroup(this, 'ServiceLogs', {
      logGroupName: '/finance-tracker/services',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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

    // Outputs
    new cdk.CfnOutput(this, 'VPCId', {
      value: vpc.vpcId,
      exportName: 'FinanceTracker-VPC-ID'
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      exportName: 'FinanceTracker-Cluster-Name'
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      exportName: 'FinanceTracker-DB-Endpoint'
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: redisCluster.attrRedisEndpointAddress,
      exportName: 'FinanceTracker-Redis-Endpoint'
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      exportName: 'FinanceTracker-ALB-DNS'
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      exportName: 'FinanceTracker-CloudFront-URL'
    });
  }
}