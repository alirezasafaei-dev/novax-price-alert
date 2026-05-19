from pathlib import Path

from pydantic_settings import BaseSettings

# Find the project root directory (three levels up from the current file)
BASE_DIR = Path(__file__).resolve().parents[3]
# Define the path to the SQLite database file
DB_PATH = BASE_DIR / "bale_price_alert.db"


class Settings(BaseSettings):
    app_name: str = "bale-price-alert"
    debug: bool = False
    # Use the absolute path for the database URL, ensuring compatibility with async drivers
    database_url: str = f"sqlite+aiosqlite:///{DB_PATH}"


settings = Settings()
