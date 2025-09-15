#!/bin/bash
REGION="eu-south-1"
echo "🗑️ Deleting existing ECR repositories..."

aws ecr delete-repository --repository-name finance-tracker/gateway --region $REGION --force 2>/dev/null || true
aws ecr delete-repository --repository-name finance-tracker/auth --region $REGION --force 2>/dev/null || true  
aws ecr delete-repository --repository-name finance-tracker/expense --region $REGION --force 2>/dev/null || true
aws ecr delete-repository --repository-name finance-tracker/income --region $REGION --force 2>/dev/null || true
aws ecr delete-repository --repository-name finance-tracker/category --region $REGION --force 2>/dev/null || true
aws ecr delete-repository --repository-name finance-tracker/analytics --region $REGION --force 2>/dev/null || true
aws ecr delete-repository --repository-name finance-tracker/analytics-engine --region $REGION --force 2>/dev/null || true
aws ecr delete-repository --repository-name finance-tracker/reporting-engine --region $REGION --force 2>/dev/null || true
aws ecr delete-repository --repository-name finance-tracker/ml-engine --region $REGION --force 2>/dev/null || true

echo "✅ ECR repositories deleted!"
