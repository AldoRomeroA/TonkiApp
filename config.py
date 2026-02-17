import os
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()  # carga variables desde .env si existe

def get_db_uri():
    db_user = os.environ.get('DB_USER', 'TonkiAppRDS')
    db_password = os.environ.get('DB_PASSWORD', 'TonkiAppRDS123')
    db_host = os.environ.get('DB_HOST', 'database-1.cva2yqq2enwe.us-east-2.rds.amazonaws.com')  # por defecto localhost en desarrollo
    db_port = os.environ.get('DB_PORT', '3306')
    db_name = os.environ.get('DB_NAME', 'TonkiApp')

    return f"mysql+pymysql://{db_user}:{quote(db_password)}@{db_host}:{db_port}/{db_name}"

#mysql+pymysql://dbAdmin:A.R.A.2025n_@tiankawards-rds.cva2yqq2enwe.us-east-2.rds.amazonaws.com:3306/tiankawards"