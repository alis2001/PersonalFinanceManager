#!/bin/bash
# Monitor Redis deletion and complete cleanup

echo "⏳ MONITORING REDIS DELETION PROGRESS"
echo "======================================"

REGION="eu-south-1"
STACK_NAME="RapilotInfrastructureStack"

# Function to check Redis status
check_redis_status() {
    echo "🔍 Checking Redis cluster status..."
    
    # Check replication groups
    REDIS_GROUPS=$(aws elasticache describe-replication-groups --region $REGION --query 'ReplicationGroups[].{GroupId:ReplicationGroupId,Status:Status}' --output table 2>/dev/null)
    
    if [ -z "$REDIS_GROUPS" ] || [[ "$REDIS_GROUPS" == *"None"* ]]; then
        echo "✅ All Redis replication groups deleted!"
        return 0
    else
        echo "⏳ Redis replication groups still exist:"
        echo "$REDIS_GROUPS"
        return 1
    fi
}

# Function to check CloudFormation stack status
check_stack_status() {
    echo "🔍 Checking CloudFormation stack status..."
    
    STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo "✅ Stack no longer exists (deleted successfully)!"
        return 0
    else
        echo "📋 Current stack status: $STACK_STATUS"
        return 1
    fi
}

# Monitor deletion progress
echo "⏳ Waiting for Redis deletion to complete..."
echo "   This usually takes 5-10 minutes for ElastiCache clusters"
echo ""

ATTEMPT=1
MAX_ATTEMPTS=20  # 20 attempts = ~10 minutes with 30-second intervals

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "🔄 Attempt $ATTEMPT/$MAX_ATTEMPTS ($(date +"%H:%M:%S"))"
    
    if check_redis_status; then
        echo ""
        echo "🎉 REDIS DELETION COMPLETE!"
        echo ""
        
        # Now try to continue rollback
        echo "🔄 ATTEMPTING TO CONTINUE ROLLBACK..."
        aws cloudformation continue-update-rollback --stack-name $STACK_NAME --region $REGION
        
        if [ $? -eq 0 ]; then
            echo "✅ Rollback continuation initiated successfully!"
            echo "⏳ Monitoring rollback progress..."
            
            # Monitor rollback
            for i in {1..30}; do
                sleep 10
                if check_stack_status; then
                    echo "🎉 STACK DELETED SUCCESSFULLY!"
                    echo ""
                    echo "✅ YOU CAN NOW DEPLOY FRESH:"
                    echo "   cd ~/PersonalFinanceManager/infrastructure/aws"
                    echo "   cdk deploy"
                    exit 0
                fi
                echo "   Rollback attempt $i/30..."
            done
            
            echo "⚠️  Rollback taking longer than expected. Try manual deletion:"
            echo "   aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
            
        else
            echo "❌ Rollback continuation failed. Trying direct stack deletion..."
            aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION
            
            if [ $? -eq 0 ]; then
                echo "✅ Stack deletion initiated!"
                echo "⏳ Monitoring deletion progress..."
                
                # Monitor deletion
                for i in {1..30}; do
                    sleep 10
                    if check_stack_status; then
                        echo "🎉 STACK DELETED SUCCESSFULLY!"
                        echo ""
                        echo "✅ YOU CAN NOW DEPLOY FRESH:"
                        echo "   cd ~/PersonalFinanceManager/infrastructure/aws"
                        echo "   cdk deploy"
                        exit 0
                    fi
                    echo "   Deletion attempt $i/30..."
                done
            else
                echo "❌ Stack deletion also failed. May need AWS support."
            fi
        fi
        break
    fi
    
    echo "   Redis clusters still deleting, waiting 30 seconds..."
    sleep 30
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "⚠️  Redis deletion taking longer than expected (>10 minutes)"
    echo "   This is unusual but can happen. Options:"
    echo ""
    echo "   1. Wait longer and check manually:"
    echo "      aws elasticache describe-replication-groups --region $REGION"
    echo ""
    echo "   2. Force delete the CloudFormation stack anyway:"
    echo "      aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
    echo ""
    echo "   3. Contact AWS support if Redis clusters are truly stuck"
fi
