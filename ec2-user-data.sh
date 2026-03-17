#!/bin/bash
# Script de inicialización para EC2 Amazon Linux 2023
# Este script se ejecuta automáticamente al crear la instancia

# Actualizar el sistema
sudo yum update -y

# Instalar Python 3.11 y herramientas necesarias
sudo yum install -y python3.11 python3.11-pip git

# Instalar y configurar MySQL client
sudo yum install -y mysql

# Crear usuario para la aplicación
sudo useradd -m -s /bin/bash flaskapp || true

# Crear directorio para la aplicación
sudo mkdir -p /opt/tiankawards
sudo chown flaskapp:flaskapp /opt/tiankawards

# Instalar nginx como reverse proxy
sudo yum install -y nginx
sudo systemctl enable nginx

# Configurar firewall
sudo yum install -y firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

echo "EC2 instance initialized successfully"
