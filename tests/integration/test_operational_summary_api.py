import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.api.deps import get_db
from novax_price_alert.api.main import create_app
from novax_price_alert.core.observability import metrics, record_metric
from novax_price_alert.core.settings import settings

pytestmark = pytest.mark.integration


@pytest.mark.anyio
async def test_metrics_summary_endpoint_returns_operational_shape(
    db_session: AsyncSession,
) -> None:
    metrics.clear()
    record_metric("alert_creation_count")
    app = create_app()

    async def override_get_db() -> AsyncSession:
        return db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/metrics/summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["metrics"] == {"alert_creation_count": 1}
    assert payload["alerts_by_state"] == {}
    assert payload["events_by_status"] == {}
    assert payload["latest_prices"] == {
        "total": 0,
        "fresh": 0,
        "stale": 0,
        "oldest_observed_at": None,
        "newest_observed_at": None,
    }


@pytest.mark.anyio
async def test_metrics_summary_endpoint_uses_metrics_token(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "metrics_access_token", "summary-token")
    app = create_app()

    async def override_get_db() -> AsyncSession:
        return db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        missing_token = await client.get("/metrics/summary")
        wrong_token = await client.get("/metrics/summary", headers={"X-Metrics-Token": "wrong"})
        valid_token = await client.get(
            "/metrics/summary",
            headers={"X-Metrics-Token": "summary-token"},
        )

    assert missing_token.status_code == 401
    assert wrong_token.status_code == 401
    assert valid_token.status_code == 200
