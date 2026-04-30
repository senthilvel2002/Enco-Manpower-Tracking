import os
from dotenv import load_dotenv

load_dotenv(override=True)


class Config:
    MONGODB_URI = os.getenv("MONGODB_URI", "")
    MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "enco_manpower")
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").strip()
    SITE_INCHARGE_LOGIN_PASSWORD = os.getenv("SITE_INCHARGE_LOGIN_PASSWORD", "0000")
    MANAGEMENT_LOGIN_PASSWORD = os.getenv("MANAGEMENT_LOGIN_PASSWORD", "25017")
