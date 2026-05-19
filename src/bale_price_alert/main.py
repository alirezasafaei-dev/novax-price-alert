from fastapi import FastAPI

from bale_price_alert.api.health import router as health_router
from bale_price_alert.core.settings import settings


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)
    app.include_router(health_router)
    return app


app = create_app()
