from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from novax_price_alert.api.routers.alerts import router as alerts_router
from novax_price_alert.api.routers.health import router as health_router
from novax_price_alert.api.routers.metrics import router as metrics_router
from novax_price_alert.api.routers.prices import router as prices_router
from novax_price_alert.api.routers.webhook import router as webhook_router
from novax_price_alert.api.templates import TWA_SHELL_HTML


def create_app() -> FastAPI:
    app = FastAPI(title="Novax Price Alert API")

    # CORS for TWA / external frontends (public API)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://novax.alirezasafaeisystems.ir",
            "https://*.alirezasafaeisystems.ir",
            "https://t.me",
            "https://web.telegram.org",
            "*",  # safe for public price API; tighten if needed
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(metrics_router)
    app.include_router(prices_router, prefix="/api/v1")
    app.include_router(alerts_router, prefix="/api/v1")
    app.include_router(webhook_router, prefix="/api/v1")

    @app.get("/", response_class=HTMLResponse)
    async def twa_shell() -> str:
        return TWA_SHELL_HTML

    return app


app = create_app()
