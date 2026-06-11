from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Find the project root directory (three levels up from the current file)
BASE_DIR = Path(__file__).resolve().parents[3]
# Define the path to the SQLite database file
DB_PATH = BASE_DIR / "novax_price_alert.db"


def normalize_database_url(value: str) -> str:
    if not isinstance(value, str):
        return value

    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+asyncpg://", 1)
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    debug: bool = False
    database_url: str = f"sqlite+aiosqlite:///{DB_PATH}"
    # Leave empty or set to localhost for single-instance deployments.
    redis_url: str = "redis://localhost:6379/0"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        return normalize_database_url(value)

    telegram_bot_token: str = ""
    telegram_relay_url: str = ""
    telegram_relay_secret: str = ""
    telegram_auth_max_age_seconds: int = 86_400
    telegram_send_timeout_seconds: int = 10
    metrics_access_token: str = ""
    ingest_api_token: str = ""
    admin_access_token: str = ""

    alanchand_api_token: str = ""
    alanchand_base_url: str = "https://api.alanchand.com"
    api_ir_api_key: str = ""
    api_ir_base_url: str = ""
    bonbast_base_url: str = "https://bonbast.com"
    enable_bonbast_failover: bool = False
    nerkh_api_key: str = ""
    nerkh_base_url: str = "https://api.nerkh.io"
    tgju_base_url: str = "https://www.tgju.org"

    # ── Scalability parameters ──────────────────────────────────────
    # How long (seconds) cached provider prices are considered valid.
    # Lower = fresher data but more upstream calls. Higher = less load, staler data.
    # Range: 10-300 seconds. Default: 60.
    provider_cache_ttl_seconds: int = Field(default=60, ge=10, le=300)
    # After how many seconds without an update a price is considered stale.
    # Should be >= provider_cache_ttl_seconds. Default: 180.
    stale_price_seconds: int = Field(default=180, ge=60)
    # Interval (seconds) between alert worker evaluation runs.
    # Lower = faster alert response but more DB/CPU load.
    # Range: 15-600 seconds. Default: 60.
    worker_interval_seconds: int = Field(default=60, ge=15)
    # Interval (seconds) between notification dispatch runs.
    # Lower = faster notification delivery but more API calls.
    # Range: 1-60 seconds. Default: 5.
    notification_interval_seconds: int = Field(default=5, ge=1)
    # Maximum number of assets to evaluate concurrently per evaluation cycle.
    # Higher = faster evaluation but more DB connections and memory.
    # Range: 1-50. Default: 10.
    max_concurrent_asset_evaluations: int = Field(default=10, ge=1, le=50)
    # Maximum number of notification events to dispatch per cycle.
    # Higher = faster draining of the notification queue but more API calls.
    # Range: 1-100. Default: 20.
    max_notifications_per_cycle: int = Field(default=20, ge=1, le=100)
    use_mock_provider: bool = False
    use_mock_notifications: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
