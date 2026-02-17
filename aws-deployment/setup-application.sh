#!/bin/bash
# Script para configurar la aplicación en EC2 después de conectarte por SSH
# Ejecutar como ec2-user

set -e

echo "=== Configurando aplicación TianKAwards en EC2 ==="

# 1. Clonar o copiar el código de la aplicación
echo "Preparando directorio de aplicación..."
sudo mkdir -p /opt/tiankawards
sudo chown flaskapp:flaskapp /opt/tiankawards

# 2. Copiar archivos (asume que están en el home del usuario)
echo "Copiando archivos de aplicación..."
sudo cp -r ~/tiankawards-app/* /opt/tiankawards/ || echo "Copia los archivos manualmente"
sudo chown -R flaskapp:flaskapp /opt/tiankawards

# 3. Configurar el servicio systemd
echo "Configurando servicio systemd..."
sudo cp /opt/tiankawards/aws-deployment/tiankawards.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tiankawards

# 4. Configurar nginx
echo "Configurando nginx..."
sudo cp /opt/tiankawards/aws-deployment/nginx-tiankawards.conf /etc/nginx/conf.d/
sudo nginx -t
sudo systemctl restart nginx

# 5. Ejecutar deployment inicial
echo "Ejecutando deployment inicial..."
sudo -u flaskapp bash /opt/tiankawards/aws-deployment/deploy-app.sh

# 6. Verificar estado
echo ""
echo "=== Verificando servicios ==="
sudo systemctl status tiankawards --no-pager
sudo systemctl status nginx --no-pager

echo ""
echo "=== Configuración completada ==="
echo "La aplicación debería estar corriendo en el puerto 80"
echo "Verifica los logs con: sudo journalctl -u tiankawards -f"
