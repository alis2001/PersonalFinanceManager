#!/bin/bash
# Precise fix for the stuck CloudFormation stack

echo "🔧 FIXING STUCK CLOUDFORMATION STACK"
echo "====================================="

REGION="eu-south-1"
STACK_NAME="RapilotInfrastructureStack"

echo "📍 Region: $REGION"
echo "📋 Stack: $STACK_NAME"
echo ""

# Step 1: Check current stack status
echo "1️⃣ CHECKING CURRENT STACK STATUS"
echo "---------------------------------"
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].{Status:StackStatus,Reason:StackStatusReason}' \
    --output table

echo ""

# Step 2: Find the stuck Redis cluster
echo "2️⃣ FINDING STUCK REDIS CLUSTER"
echo "-------------------------------"
echo "Redis Replication Groups:"
aws elasticache describe-replication-groups \
    --region $REGION \
    --query 'ReplicationGroups[].{GroupId:ReplicationGroupId,Status:Status,Description:Description}' \
    --output table

echo ""
echo "Redis Cache Clusters:"
aws elasticache describe-cache-clusters \
    --region $REGION \
    --query 'CacheClusters[].{ClusterId:CacheClusterId,Status:CacheClusterStatus,ReplicationGroupId:ReplicationGroupId}' \
    --output table

echo ""

# Step 3: Try to continue rollback (sometimes this works)
echo "3️⃣ ATTEMPTING TO CONTINUE ROLLBACK"
echo "-----------------------------------"
echo "Trying to continue rollback for stuck stack..."

aws cloudformation continue-update-rollback \
    --stack-name $STACK_NAME \
    --region $REGION \
    --resources-to-skip RedisCluster

if [ $? -eq 0 ]; then
    echo "✅ Rollback continuation initiated successfully!"
    echo "⏳ Wait 5-10 minutes and check stack status:"
    echo "   aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].StackStatus'"
else
    echo "❌ Rollback continuation failed. We'll need to manually delete the Redis cluster."
    echo ""
    
    # Step 4: Manual Redis cluster deletion
    echo "4️⃣ MANUAL REDIS CLUSTER DELETION"
    echo "---------------------------------"
    
    # Get Redis cluster IDs
    REDIS_GROUPS=$(aws elasticache describe-replication-groups --region $REGION --query 'ReplicationGroups[].ReplicationGroupId' --output text)
    
    if [ -n "$REDIS_GROUPS" ]; then
        for group in $REDIS_GROUPS; do
            echo "Found Redis Replication Group: $group"
            echo "Attempting to delete: $group"
            
            aws elasticache delete-replication-group \
                --replication-group-id "$group" \
                --region $REGION \
                --no-retain-primary-cluster
            
            if [ $? -eq 0 ]; then
                echo "✅ Redis replication group $group deletion initiated"
            else
                echo "❌ Failed to delete Redis replication group $group"
            fi
        done
    else
        echo "No Redis replication groups found"
    fi
    
    # Also try to delete individual cache clusters
    REDIS_CLUSTERS=$(aws elasticache describe-cache-clusters --region $REGION --query 'CacheClusters[].CacheClusterId' --output text)
    
    if [ -n "$REDIS_CLUSTERS" ]; then
        for cluster in $REDIS_CLUSTERS; do
            echo "Found Redis Cluster: $cluster"
            echo "Attempting to delete: $cluster"
            
            aws elasticache delete-cache-cluster \
                --cache-cluster-id "$cluster" \
                --region $REGION
                
            if [ $? -eq 0 ]; then
                echo "✅ Redis cluster $cluster deletion initiated"
            else
                echo "❌ Failed to delete Redis cluster $cluster"
            fi
        done
    else
        echo "No individual Redis clusters found"
    fi
fi

echo ""
echo "5️⃣ NEXT STEPS"
echo "-------------"
echo "After running this script:"
echo ""
echo "Option A - If rollback continuation worked:"
echo "  1. Wait 5-10 minutes"
echo "  2. Check if stack is DELETE_COMPLETE:"
echo "     aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION"
echo "  3. If yes, you can deploy fresh"
echo ""
echo "Option B - If manual deletion was needed:"
echo "  1. Wait 5-10 minutes for Redis deletion"
echo "  2. Try continuing rollback again:"
echo "     aws cloudformation continue-update-rollback --stack-name $STACK_NAME --region $REGION"
echo "  3. If that fails, delete the entire stack:"
echo "     aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
echo ""
echo "Option C - Nuclear option (if nothing else works):"
echo "  1. Delete stack forcefully:"
echo "     aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
echo "  2. Wait for complete deletion"
echo "  3. Deploy fresh"
echo ""
echo "✅ DIAGNOSIS COMPLETE"
