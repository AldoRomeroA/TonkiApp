import os
from urllib.parse import quote

# Etherfuse (MXN <-> crypto on/off-ramp)
# Auth: Authorization: <api_key> — NO Bearer prefix
ETHERFUSE_API_KEY = os.environ.get("ETHERFUSE_API_KEY", "")
ETHERFUSE_BASE_URL = os.environ.get(
    "ETHERFUSE_BASE_URL",
    "https://api.sand.etherfuse.com",  # Sandbox default
)
ETHERFUSE_IS_SANDBOX = "sand.etherfuse" in ETHERFUSE_BASE_URL

def get_db_uri():
    db_user = os.environ.get('DB_USER', 'u283549900_tonkiadmin')
    db_password = os.environ.get('DB_PASSWORD', 'T0nk1#2026&adm1n')
    db_host = os.environ.get('DB_HOST', 'srv1294.hstgr.io')
    #db_port = os.environ.get('DB_PORT', '3306')
    db_name = os.environ.get('DB_NAME', 'u283549900_tonki')

    return f"mysql+pymysql://{db_user}:{quote(db_password)}@{db_host}/{db_name}"