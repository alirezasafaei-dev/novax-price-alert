from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Find the project root directory (three levels up from the current file)
BASE_DIR = Path(__file__).resolve().parents[3]
# Define the path to the SQLite database file
DB_PATH = BASE_DIR / "novax_price_alert.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "iran-market-price-alert"
    debug: bool = False
    environment: str = "development"
    database_url: str = f"sqlite+aiosqlite:///{DB_PATH}"
    redis_url: str = "redis://localhost:6379/0"

    telegram_bot_token: str = ""
    telegram_relay_url: str = ""
    telegram_relay_secret: str = ""
    telegram_auth_max_age_seconds: int = 86_400
    telegram_send_timeout_seconds: int = 10
    metrics_access_token: str = ""

    alanchand_api_token: str = ""
    alanchand_base_url: str = "https://api.alanchand.com"
    api_ir_api_key: str = ""
    api_ir_base_url: str = ""
    bonbast_base_url: str = "https://bonbast.com"
    nerkh_api_key: str = ""
    nerkh_base_url: str = "https://api.nerkh.io"
    tgju_base_url: str = "https://www.tgju.org"

    provider_cache_ttl_seconds: int = Field(default=60, ge=10, le=300)
    stale_price_seconds: int = Field(default=180, ge=60)
    worker_interval_seconds: int = Field(default=60, ge=15)
    notification_interval_seconds: int = Field(default=5, ge=1)
    use_mock_provider: bool = False
    use_mock_notifications: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
