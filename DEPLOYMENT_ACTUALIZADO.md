# 🚀 Guía de Deployment Actualizada - TianKAwards

## Tu Configuración Actual

- **EC2**: Ubuntu en `ec2-18-118-148-105.us-east-2.compute.amazonaws.com`
- **Usuario**: ubuntu
- **Directorio**: `/home/ubuntu/tiankawards-app`
- **Key**: `aws-deployment/tiankawards-key.pem`
- **RDS**: `database-1.cva2yqq2enwe.us-east-2.rds.amazonaws.com`
- **Base de datos**: TonkiApp
- **Usuario DB**: TonkiAppRDS

---

## ✅ SOLUCIÓN RÁPIDA - Reiniciar Aplicación

### Opción 1: Comando TODO-EN-UNO (MÁS RÁPIDO)

Conéctate a EC2 y ejecuta:

```bash
ssh -i aws-deployment/tiankawards-key.pem ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com

# Ejecuta este comando completo:
sudo systemctl stop tiankawards && \
find ~/tiankawards-app -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true && \
find ~/tiankawards-app -type f -name "*.pyc" -delete 2>/dev/null || true && \
sudo pkill -9 gunicorn 2>/dev/null || true && \
sleep 3 && \
sudo systemctl daemon-reload && \
sudo systemctl start tiankawards && \
sleep 3 && \
sudo systemctl status tiankawards --no-pager && \
echo "" && \
echo "=== Últimos logs ===" && \
sudo journalctl -u tiankawards -n 20 --no-pager
```

### Opción 2: Usar el Script de Reinicio

```bash
# Desde tu máquina LOCAL
scp -i aws-deployment/tiankawards-key.pem reiniciar-app.sh ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com:~

# Conectarse a EC2
ssh -i aws-deployment/tiankawards-key.pem ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com

# Ejecutar el script
chmod +x reiniciar-app.sh
./reiniciar-app.sh
```

---

## 🔄 DEPLOYMENT COMPLETO (Nueva Versión)

### Paso 1: Desde tu máquina Windows

El script `deploy-to-ec2.sh` ya está configurado con tus datos. Solo ejecuta:

```bash
# Si tienes Git Bash
bash deploy-to-ec2.sh

# O usa WSL
wsl bash deploy-to-ec2.sh
```

Esto hará automáticamente:
1. Crear .env de producción
2. Comprimir la aplicación
3. Subir a EC2
4. Detener servicio anterior
5. Hacer backup
6. Instalar nueva versión
7. Reiniciar servicio

### Paso 2: Verificar

```bash
# Ver logs
ssh -i aws-deployment/tiankawards-key.pem ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com "sudo journalctl -u tiankawards -f"

# Probar en navegador
http://ec2-18-118-148-105.us-east-2.compute.amazonaws.com/
http://ec2-18-118-148-105.us-east-2.compute.amazonaws.com/dashboard
```

---

## 📝 DEPLOYMENT MANUAL (Si el automático falla)

### Paso 1: Comprimir la aplicación

En tu máquina LOCAL (Windows):

```bash
tar -czf tiankawards-app.tar.gz \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='.git' \
  --exclude='*.pyc' \
  --exclude='*.pem' \
  app.py config.py extensions.py requirements.txt \
  admin_dashboard/ static/ templates/
```

### Paso 2: Subir a EC2

```bash
scp -i aws-deployment/tiankawards-key.pem tiankawards-app.tar.gz ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com:~
```

### Paso 3: Conectarse a EC2

```bash
ssh -i aws-deployment/tiankawards-key.pem ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com
```

### Paso 4: Deployment en EC2

```bash
# Detener servicio
sudo systemctl stop tiankawards

# Backup de versión anterior
mv ~/tiankawards-app ~/tiankawards-app.backup.$(date +%Y%m%d_%H%M%S)

# Crear directorio nuevo
mkdir -p ~/tiankawards-app

# Extraer nueva versión
tar -xzf ~/tiankawards-app.tar.gz -C ~/tiankawards-app/

# Verificar que el .env existe (si no, créalo)
if [ ! -f ~/tiankawards-app/.env ]; then
    cat > ~/tiankawards-app/.env << 'EOF'
DB_USER=TonkiAppRDS
DB_PASSWORD=TonkiAppRDS123
DB_HOST=database-1.cva2yqq2enwe.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_NAME=TonkiApp
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
FLASK_ENV=production
EOF
    chmod 600 ~/tiankawards-app/.env
fi

# Instalar dependencias
cd ~/tiankawards-app
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn python-dotenv

# Limpiar caché
find ~/tiankawards-app -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find ~/tiankawards-app -type f -name "*.pyc" -delete 2>/dev/null || true

# Reiniciar servicio
sudo systemctl daemon-reload
sudo systemctl start tiankawards

# Verificar
sudo systemctl status tiankawards
```

---

## 🔧 Actualizar Configuración de Systemd

Si el servicio no existe o necesitas actualizarlo:

```bash
# En EC2
sudo nano /etc/systemd/system/tiankawards.service
```

Pega este contenido:

```ini
[Unit]
Description=TianKAwards Flask Application
After=network.target

[Service]
Type=notify
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/tiankawards-app
Environment="PATH=/home/ubuntu/tiankawards-app/venv/bin"
EnvironmentFile=/home/ubuntu/tiankawards-app/.env
ExecStart=/home/ubuntu/tiankawards-app/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 --timeout 120 app:app
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Luego:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tiankawards
sudo systemctl start tiankawards
```

---

## 🔍 Verificación y Troubleshooting

### Ver logs en tiempo real

```bash
sudo journalctl -u tiankawards -f
```

### Ver últimos 50 logs

```bash
sudo journalctl -u tiankawards -n 50 --no-pager
```

### Verificar estado del servicio

```bash
sudo systemctl status tiankawards
```

### Probar la aplicación localmente

```bash
curl http://localhost
curl http://localhost/dashboard
```

### Ver procesos de Gunicorn

```bash
ps aux | grep gunicorn
```

### Verificar configuración de Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
```

---

## 🛠️ Comandos Útiles

### Reiniciar servicios

```bash
sudo systemctl restart tiankawards
sudo systemctl restart nginx
```

### Ver configuración actual

```bash
# Ver .env (sin mostrar contraseñas)
cat ~/tiankawards-app/.env | sed 's/PASSWORD=.*/PASSWORD=***OCULTO***/g'

# Ver servicio systemd
cat /etc/systemd/system/tiankawards.service
```

### Probar conexión a RDS

```bash
cd ~/tiankawards-app
source venv/bin/activate
python test_db_connection.py
```

### Actualización rápida (solo código)

```bash
# Desde Windows
scp -i aws-deployment/tiankawards-key.pem app.py ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com:~/tiankawards-app/
scp -i aws-deployment/tiankawards-key.pem -r templates ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com:~/tiankawards-app/

# Reiniciar
ssh -i aws-deployment/tiankawards-key.pem ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com "sudo systemctl restart tiankawards"
```

---

## 📋 Checklist de Deployment

Antes de hacer deployment:

- [ ] Probaste localmente: `python app.py`
- [ ] Actualizaste `requirements.txt` si agregaste librerías
- [ ] Verificaste que `.env` tiene las credenciales correctas
- [ ] Hiciste commit de tus cambios (opcional)

Después del deployment:

- [ ] El servicio está corriendo: `sudo systemctl status tiankawards`
- [ ] No hay errores en logs: `sudo journalctl -u tiankawards -n 20`
- [ ] La aplicación responde: `curl http://localhost`
- [ ] El dashboard muestra datos de RDS

---

## 🎯 Accesos Rápidos

```bash
# SSH a EC2
ssh -i aws-deployment/tiankawards-key.pem ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com

# Ver logs
ssh -i aws-deployment/tiankawards-key.pem ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com "sudo journalctl -u tiankawards -f"

# Reiniciar
ssh -i aws-deployment/tiankawards-key.pem ubuntu@ec2-18-118-148-105.us-east-2.compute.amazonaws.com "sudo systemctl restart tiankawards"
```

## 🌐 URLs de la Aplicación

- **Login**: http://ec2-18-118-148-105.us-east-2.compute.amazonaws.com/
- **Dashboard**: http://ec2-18-118-148-105.us-east-2.compute.amazonaws.com/dashboard

---

## 💡 Notas Importantes

1. El directorio es `~/tiankawards-app` (en el home de ubuntu)
2. El usuario del servicio es `ubuntu` (no flaskapp)
3. El archivo `.env` debe estar en `~/tiankawards-app/.env`
4. Siempre limpia el caché de Python después de actualizar
5. Si cambias el servicio systemd, ejecuta `sudo systemctl daemon-reload`
