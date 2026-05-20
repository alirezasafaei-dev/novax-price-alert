from fastapi import FastAPI

from bale_price_alert.api.routers.alerts import router as alerts_router
from bale_price_alert.api.routers.health import router as health_router
from bale_price_alert.api.routers.prices import router as prices_router
from bale_price_alert.api.routers.webhook import router as webhook_router


def create_app() -> FastAPI:
    app = FastAPI(title="Bale Price Alert API")

    app.include_router(health_router)
    app.include_router(prices_router, prefix="/api/v1")
    app.include_router(alerts_router, prefix="/api/v1")
    app.include_router(webhook_router, prefix="/api/v1")

    return app


app = create_app()
