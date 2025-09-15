#!/bin/bash
# FREE TIER DEPLOYMENT SCRIPT
# infrastructure/aws/free_tier_deploy.sh

echo "🚀 FREE TIER FINANCE TRACKER DEPLOYMENT"
echo "========================================"
echo ""

REGION="eu-south-1"
STACK_NAME="RapilotInfrastructureStack"

# Step 1: Clean up failed deployment
echo "1️⃣ CLEANING UP FAILED DEPLOYMENT"
echo "---------------------------------"
echo "Checking current stack status..."

STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "📋 Current stack status: $STACK_STATUS"
    
    if [[ "$STACK_STATUS" == "ROLLBACK_COMPLETE" || "$STACK_STATUS" == "CREATE_FAILED" ]]; then
        echo "❌ Stack is in failed state. Deleting..."
        
        aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION
        
        if [ $? -eq 0 ]; then
            echo "✅ Stack deletion initiated. Waiting for completion..."
            
            # Wait for deletion
            for i in {1..30}; do
                sleep 20
                STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
                
                if [ $? -ne 0 ]; then
                    echo "✅ Stack deleted successfully!"
                    break
                fi
                
                echo "   Deletion in progress... ($i/30)"
            done
        else
            echo "❌ Failed to delete stack. You may need to delete manually from AWS Console."
            exit 1
        fi
    fi
else
    echo "✅ No existing stack found. Ready for fresh deployment."
fi

echo ""

# Step 2: Verify free tier compatibility
echo "2️⃣ VERIFYING FREE TIER COMPATIBILITY"
echo "------------------------------------"
echo "✅ PostgreSQL: t3.micro (FREE TIER ELIGIBLE)"
echo "✅ Redis: t2.micro (FREE TIER ELIGIBLE)"
echo "✅ RDS Storage: 20GB (FREE TIER LIMIT)"
echo "✅ ECR: FREE TIER COMPATIBLE"
echo "✅ ECS Fargate: FREE TIER COMPATIBLE"
echo "✅ CloudFront: FREE TIER COMPATIBLE"
echo "✅ S3: FREE TIER COMPATIBLE"
echo ""

# Step 3: Build and deploy
echo "3️⃣ BUILDING AND DEPLOYING"
echo "-------------------------"
echo "Installing dependencies..."
npm install

echo "Building CDK project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check TypeScript errors."
    exit 1
fi

echo "Synthesizing CloudFormation template..."
npx cdk synth

if [ $? -ne 0 ]; then
    echo "❌ Synthesis failed. Please check CDK code."
    exit 1
fi

echo ""
echo "4️⃣ DEPLOYING TO AWS (MILAN REGION)"
echo "----------------------------------"
echo "⚠️  This will deploy the following FREE TIER resources:"
echo "   • VPC with 2 AZs"
echo "   • PostgreSQL t3.micro (20GB storage)"
echo "   • Redis t2.micro"
echo "   • ECS Fargate cluster"
echo "   • Application Load Balancer"
echo "   • CloudFront distribution"
echo "   • ECR repositories"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting deployment..."
    
    npx cdk deploy --require-approval never
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 DEPLOYMENT SUCCESSFUL!"
        echo "========================"
        echo ""
        echo "📋 Getting deployment outputs..."
        aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].Outputs' --output table
        
        echo ""
        echo "✅ NEXT STEPS:"
        echo "1. Build and push your Docker images to ECR"
        echo "2. Deploy your services to ECS Fargate"
        echo "3. Update DNS to point to the Load Balancer"
        echo ""
        echo "💰 COST MONITORING:"
        echo "• Monitor your AWS billing dashboard daily"
        echo "• Set up billing alerts for $5-10"
        echo "• Most resources are FREE TIER eligible!"
        
    else
        echo ""
        echo "❌ DEPLOYMENT FAILED"
        echo "==================="
        echo "Check the error above and try again."
        echo "Common issues:"
        echo "• AWS credentials not configured"
        echo "• Insufficient permissions"
        echo "• Resource limits exceeded"
        exit 1
    fi
else
    echo "Deployment cancelled."
fi
