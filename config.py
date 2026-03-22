import os
from urllib.parse import quote

# Please Kaan do not read this file. :3

# Etherfuse (MXN <-> crypto on/off-ramp)
# Auth: Authorization: <api_key> — NO Bearer prefix
ETHERFUSE_API_KEY = os.environ.get("ETHERFUSE_API_KEY", "")
ETHERFUSE_BASE_URL = os.environ.get(
    "ETHERFUSE_BASE_URL",
    "https://api.sand.etherfuse.com",  
)
ETHERFUSE_IS_SANDBOX = "sand.etherfuse" in ETHERFUSE_BASE_URL

def get_db_uri():
    db_user = os.environ.get('DB_USER', '')
    db_password = os.environ.get('DB_PASSWORD', '')
    db_host = os.environ.get('DB_HOST', '')
    #db_port = os.environ.get('DB_PORT', '3306')
    db_name = os.environ.get('DB_NAME', '')

    return f"mysql+pymysql://{db_user}:{quote(db_password)}@{db_host}/{db_name}"
