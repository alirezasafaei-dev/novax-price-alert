from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "bale-price-alert"
    debug: bool = False
    database_url: str = "sqlite:///./bale_price_alert.db"


settings = Settings()
