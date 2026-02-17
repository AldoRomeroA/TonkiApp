#!/bin/bash
# Script para crear la infraestructura AWS usando AWS CLI
# Asegúrate de tener configurado tu perfil IAM

set -e

# Variables de configuración
REGION="us-east-2"
KEY_NAME="tiankawards-key"
INSTANCE_TYPE="t3.micro"
AMI_ID="ami-0c55b159cbfafe1f0"  # Amazon Linux 2023 en us-east-2 (verificar última versión)
SECURITY_GROUP_NAME="tiankawards-sg"
RDS_SECURITY_GROUP_NAME="tiankawards-rds-sg"

echo "=== Creando infraestructura AWS para TianKAwards ==="

# 1. Crear Key Pair si no existe
echo "Verificando Key Pair..."
if ! aws ec2 describe-key-pairs --key-names $KEY_NAME --region $REGION 2>/dev/null; then
    echo "Creando Key Pair..."
    aws ec2 create-key-pair \
        --key-name $KEY_NAME \
        --region $REGION \
        --query 'KeyMaterial' \
        --output text > ${KEY_NAME}.pem
    chmod 400 ${KEY_NAME}.pem
    echo "Key Pair guardado en ${KEY_NAME}.pem - GUÁRDALO EN LUGAR SEGURO"
else
    echo "Key Pair ya existe"
fi

# 2. Obtener VPC por defecto
echo "Obteniendo VPC..."
VPC_ID=$(aws ec2 describe-vpcs \
    --region $REGION \
    --filters "Name=isDefault,Values=true" \
    --query 'Vpcs[0].VpcId' \
    --output text)
echo "VPC ID: $VPC_ID"

# 3. Crear Security Group para EC2
echo "Creando Security Group para EC2..."
SG_ID=$(aws ec2 create-security-group \
    --group-name $SECURITY_GROUP_NAME \
    --description "Security group for TianKAwards Flask app" \
    --vpc-id $VPC_ID \
    --region $REGION \
    --query 'GroupId' \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
        --group-names $SECURITY_GROUP_NAME \
        --region $REGION \
        --query 'SecurityGroups[0].GroupId' \
        --output text)
echo "Security Group ID: $SG_ID"

# 4. Configurar reglas del Security Group
echo "Configurando reglas de firewall..."
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region $REGION 2>/dev/null || echo "Regla HTTP ya existe"

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region $REGION 2>/dev/null || echo "Regla HTTPS ya existe"

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 \
    --region $REGION 2>/dev/null || echo "Regla SSH ya existe"

# 5. Obtener el Security Group de RDS existente
echo "Obteniendo Security Group de RDS..."
RDS_SG_ID=$(aws ec2 describe-security-groups \
    --region $REGION \
    --filters "Name=group-name,Values=*rds*" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

if [ "$RDS_SG_ID" != "None" ] && [ ! -z "$RDS_SG_ID" ]; then
    echo "RDS Security Group ID: $RDS_SG_ID"
    echo "Permitiendo acceso desde EC2 a RDS..."
    aws ec2 authorize-security-group-ingress \
        --group-id $RDS_SG_ID \
        --protocol tcp \
        --port 3306 \
        --source-group $SG_ID \
        --region $REGION 2>/dev/null || echo "Regla MySQL ya existe"
else
    echo "ADVERTENCIA: No se encontró Security Group de RDS. Configúralo manualmente."
fi

# 6. Crear instancia EC2
echo "Creando instancia EC2..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $SG_ID \
    --region $REGION \
    --user-data file://ec2-user-data.sh \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=TianKAwards-Flask}]' \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "Instancia EC2 creada: $INSTANCE_ID"
echo "Esperando a que la instancia esté corriendo..."

aws ec2 wait instance-running \
    --instance-ids $INSTANCE_ID \
    --region $REGION

# 7. Obtener IP pública
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo ""
echo "=== Infraestructura creada exitosamente ==="
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "Security Group: $SG_ID"
echo ""
echo "Para conectarte por SSH:"
echo "ssh -i ${KEY_NAME}.pem ec2-user@${PUBLIC_IP}"
echo ""
echo "Espera 2-3 minutos para que el user-data termine de ejecutarse."
