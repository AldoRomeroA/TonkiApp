# Guía de Deployment AWS - TianKAwards

Esta guía te ayudará a desplegar tu aplicación Flask con Web3 en AWS usando EC2 y RDS MySQL.

## Arquitectura

- **EC2**: Amazon Linux 2023 con Flask + Gunicorn + Nginx
- **RDS**: MySQL (ya configurado en us-east-2)
- **Región**: us-east-2 (Ohio)

## Prerrequisitos

1. AWS CLI instalado y configurado con tu perfil IAM
2. Credenciales con permisos para EC2, RDS, VPC
3. Tu instancia RDS MySQL ya está corriendo

## Paso 1: Crear la Infraestructura          OK

```bash
cd aws-deployment
chmod +x *.sh
./create-infrastructure.sh
```

Este script creará:
- Key Pair para SSH
- Security Group para EC2
- Instancia EC2 t3.micro
- Reglas de firewall (HTTP, HTTPS, SSH)
- Conexión entre EC2 y RDS

**IMPORTANTE**: Guarda el archivo `.pem` generado en un lugar seguro.

## Paso 2: Verificar AMI ID                    OK

El script usa una AMI de Amazon Linux 2023. Verifica la última versión para us-east-2:
# ami-05efc83cb5512477c
```bash
aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*" "Name=architecture,Values=x86_64" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --region us-east-2 \
  --output text
```

Actualiza el `AMI_ID` en `create-infrastructure.sh` si es necesario.

## Paso 3: Conectarse a EC2

Después de crear la instancia, espera 2-3 minutos y conéctate:

```bash
ssh -i tiankawards-key.pem ec2-user@<PUBLIC_IP>


ssh -i "C:\Users\USER\Documents\Tonki-App\aws-deployment\tiankawards-key.pem"  ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com
```

## Paso 4: Subir el Código

Desde tu máquina local, sube los archivos:

```bash
# Comprimir el proyecto (excluye venv y archivos innecesarios)
tar -czf tiankawards-app.tar.gz \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='.git' \
  --exclude='*.pyc' \
  app.py config.py extensions.py requirements.txt \
  admin_dashboard/ static/ templates/ aws-deployment/

# Subir a EC2
scp -i tiankawards-key.pem tiankawards-app.tar.gz ec2-user@<PUBLIC_IP>:~

# En EC2, descomprimir
ssh -i tiankawards-key.pem ec2-user@<PUBLIC_IP>
# ese este
scp -i "C:\Users\USER\Documents\Tonki-App\aws-deployment\tiankawards-key.pem" tiankawards-app.tar.gz ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com:/home/ubuntu/

mkdir -p tiankawards-app
tar -xzf tiankawards-app.tar.gz -C tiankawards-app/
```

## Paso 5: Configurar la Aplicación

En la instancia EC2:

```bash
cd ~
chmod +x tiankawards-app/aws-deployment/setup-application.sh
./tiankawards-app/aws-deployment/setup-application.sh
```

## Paso 6: Verificar

```bash
# Ver logs de la aplicación
sudo journalctl -u tiankawards -f

# Ver logs de nginx
sudo tail -f /var/log/nginx/tiankawards-error.log

# Verificar estado
sudo systemctl status tiankawards
sudo systemctl status nginx

# Probar la aplicación
curl http://localhost
```

## Comandos Útiles

### Reiniciar servicios
```bash
sudo systemctl restart tiankawards
sudo systemctl restart nginx
```

### Ver logs
```bash
# Logs de Flask
sudo journalctl -u tiankawards -n 100 --no-pager

# Logs de nginx
sudo tail -100 /var/log/nginx/tiankawards-error.log
```

### Actualizar código
```bash
# Sube nuevos archivos y ejecuta
sudo -u flaskapp bash /opt/tiankawards/aws-deployment/deploy-app.sh
```

### Conectarse a RDS
```bash
mysql -h tiankawards-rds.cva2yqq2enwe.us-east-2.rds.amazonaws.com \
  -u dbAdmin -p tiankawards
```

## Seguridad

### Actualizar contraseña de RDS
Cambia la contraseña en:
1. AWS Console → RDS → Modify
2. Actualiza `/opt/tiankawards/.env` en EC2
3. Reinicia: `sudo systemctl restart tiankawards`

### Restringir acceso SSH
Edita el Security Group para permitir SSH solo desde tu IP:

```bash
aws ec2 revoke-security-group-ingress \
  --group-id <SG_ID> \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --region us-east-2

aws ec2 authorize-security-group-ingress \
  --group-id <SG_ID> \
  --protocol tcp \
  --port 22 \
  --cidr <TU_IP>/32 \
  --region us-east-2
```

## Configurar HTTPS (Opcional)

Para producción, configura un certificado SSL:

1. Obtén un dominio
2. Usa AWS Certificate Manager o Let's Encrypt
3. Actualiza la configuración de nginx

## Monitoreo

### CloudWatch
Los logs de EC2 se envían automáticamente a CloudWatch.

### Alarmas básicas
```bash
# CPU alta
aws cloudwatch put-metric-alarm \
  --alarm-name tiankawards-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=InstanceId,Value=<INSTANCE_ID> \
  --evaluation-periods 2 \
  --region us-east-2
```

## Troubleshooting

### La aplicación no inicia
```bash
# Verificar logs
sudo journalctl -u tiankawards -n 50

# Verificar permisos
ls -la /opt/tiankawards

# Probar manualmente
sudo -u flaskapp bash
cd /opt/tiankawards
source venv/bin/activate
python app.py
```

### No se conecta a RDS
```bash
# Verificar conectividad
telnet tiankawards-rds.cva2yqq2enwe.us-east-2.rds.amazonaws.com 3306

# Verificar Security Groups
aws ec2 describe-security-groups --region us-east-2
```

### Nginx muestra error 502
```bash
# Verificar que Flask esté corriendo
curl http://127.0.0.1:5000

# Verificar configuración de nginx
sudo nginx -t
```

## Costos Estimados (us-east-2)

- EC2 t3.micro: ~$7.50/mes
- RDS db.t3.micro: ~$15/mes
- Almacenamiento: ~$2/mes
- **Total**: ~$25/mes

## Backup

### Snapshot de EC2
```bash
aws ec2 create-snapshot \
  --volume-id <VOLUME_ID> \
  --description "TianKAwards backup" \
  --region us-east-2
```

### Backup de RDS
AWS hace backups automáticos. Para manual:
```bash
aws rds create-db-snapshot \
  --db-instance-identifier tiankawards-rds \
  --db-snapshot-identifier tiankawards-manual-backup-$(date +%Y%m%d) \
  --region us-east-2
```

## Soporte

Para problemas o preguntas, revisa:
- Logs de aplicación: `sudo journalctl -u tiankawards`
- Logs de nginx: `/var/log/nginx/`
- Estado de servicios: `sudo systemctl status`
