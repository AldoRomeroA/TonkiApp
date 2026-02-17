#!/bin/bash
# Script para obtener la última AMI de Amazon Linux 2023

REGION="us-east-2"

echo "Obteniendo última AMI de Amazon Linux 2023 para región $REGION..."

AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*" "Name=architecture,Values=x86_64" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name,CreationDate]' \
  --region $REGION \
  --output table)

echo "$AMI_ID"
echo ""
echo "Copia el ImageId y actualízalo en create-infrastructure.sh"
