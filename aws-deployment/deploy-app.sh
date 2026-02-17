#!/bin/bash
# Script para desplegar la aplicación Flask en EC2
# Ejecutar como usuario flaskapp

set -e

APP_DIR="/opt/tiankawards"
VENV_DIR="$APP_DIR/venv"

echo "=== Iniciando deployment de TianKAwards ==="

# Ir al directorio de la aplicación
cd $APP_DIR

# Crear entorno virtual si no existe
if [ ! -d "$VENV_DIR" ]; then
    echo "Creando entorno virtual..."
    python3.12 -m venv $VENV_DIR
fi

# Activar entorno virtual
source $VENV_DIR/bin/activate

# Instalar/actualizar dependencias
echo "Instalando dependencias..."
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn python-dotenv

# Crear archivo .env si no existe
if [ ! -f "$APP_DIR/.env" ]; then
    echo "Creando archivo .env..."
    cat > $APP_DIR/.env << 'EOF'
DB_USER="TonkiAppRDS"
DB_PASSWORD="TonkiAppRDS123"
DB_HOST="database-1.cva2yqq2enwe.us-east-2.rds.amazonaws.com"
DB_PORT="3306"
DB_NAME="TonkiApp"
EOF
    chmod 600 $APP_DIR/.env
fi

# Reiniciar el servicio
echo "Reiniciando servicio..."
sudo systemctl restart tiankawards

echo "=== Deployment completado ==="
echo "Verificar estado: sudo systemctl status tiankawards"
