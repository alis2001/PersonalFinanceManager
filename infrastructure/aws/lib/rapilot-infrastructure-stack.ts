import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class RapilotInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Simple VPC - testing basic networking
    const vpc = new ec2.Vpc(this, 'TestVPC', {
      maxAzs: 2,
      natGateways: 1,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });

    // Database security group
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc: vpc,
      description: 'Test database security group',
      allowAllOutbound: false
    });

    // Allow PostgreSQL access from VPC
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock), 
      ec2.Port.tcp(5432), 
      'PostgreSQL from VPC'
    );

    // Database credentials
    const dbSecret = new secretsmanager.Secret(this, 'DBSecret', {
      description: 'Test database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'testuser' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\'
      }
    });

    // TEST: Single RDS instance instead of Aurora cluster
    // This tests if the issue is Aurora-specific
    const database = new rds.DatabaseInstance(this, 'TestDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15 // Use base version instead of specific patch
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: 'testdb',
      securityGroups: [dbSecurityGroup],
      deletionProtection: false,
      storageEncrypted: false,
      backupRetention: cdk.Duration.days(1), // Fixed: correct property name
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Outputs for testing
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      description: 'Test database endpoint'
    });

    new cdk.CfnOutput(this, 'VPCId', {
      value: vpc.vpcId,
      description: 'Test VPC ID'
    });

    new cdk.CfnOutput(this, 'TestResults', {
      value: 'Single RDS instance deployment test',
      description: 'If this succeeds, the issue is Aurora-specific'
    });
  }
}