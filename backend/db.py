import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, PyMongoError, ServerSelectionTimeoutError
from pymongo.server_api import ServerApi

_client = None
_database = None


class DatabaseUnavailable(RuntimeError):
    pass


def _get_int_env(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# Load .env once at import time.
load_dotenv(override=False)


def get_database():
    global _client, _database

    if _database is not None:
        return _database

    mongodb_uri = os.getenv("MONGODB_URI", "")
    mongodb_uri_fallback = (os.getenv("MONGODB_URI_FALLBACK") or "").strip()
    mongodb_db_name = os.getenv("MONGODB_DB_NAME", "enco_manpower")

    if not mongodb_uri:
        raise ValueError("MONGODB_URI is not set. Add it to environment variables.")

    # Fail fast instead of hanging requests when Atlas is unreachable / TLS fails.
    server_selection_timeout_ms = _get_int_env("MONGODB_SERVER_SELECTION_TIMEOUT_MS", 3000)
    connect_timeout_ms = _get_int_env("MONGODB_CONNECT_TIMEOUT_MS", 5000)
    socket_timeout_ms = _get_int_env("MONGODB_SOCKET_TIMEOUT_MS", 5000)

    last_exc = None
    for uri in [mongodb_uri, mongodb_uri_fallback]:
        if not uri:
            continue
        try:
            _client = MongoClient(
                uri,
                server_api=ServerApi("1"),
                serverSelectionTimeoutMS=server_selection_timeout_ms,
                connectTimeoutMS=connect_timeout_ms,
                socketTimeoutMS=socket_timeout_ms,
                retryWrites=True,
            )
            _database = _client[mongodb_db_name]
            return _database
        except (ServerSelectionTimeoutError, ConfigurationError, PyMongoError) as exc:
            last_exc = exc
            _client = None
            _database = None

    raise DatabaseUnavailable(f"database connection failed: {last_exc}") from last_exc


def ping_database():
    if _client is None:
        get_database()
    try:
        _client.admin.command("ping")
        return True
    except (ServerSelectionTimeoutError, ConfigurationError, PyMongoError) as exc:
        raise DatabaseUnavailable(f"database ping failed: {exc}") from exc
