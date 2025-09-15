#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RapilotInfrastructureStack } from '../lib/rapilot-infrastructure-stack';

const app = new cdk.App();

new RapilotInfrastructureStack(app, 'RapilotInfrastructureStack', {
  env: { 
    account: '819080195356', 
    region: 'eu-south-1' // Milan region
  },
  description: 'Rapilot Finance Tracker - Complete AWS Infrastructure'
});
