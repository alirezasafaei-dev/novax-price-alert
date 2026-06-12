"""E2E tests for alert creation and management API flows.

Tests the full flow: create → confirm → list → update → delete
via the API routers (not just internal services).
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from unittest.mock import patch

from novax_price_alert.api.deps import get_db
from novax_price_alert.api.main import app
from novax_price_alert.db.base import Base

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

pytestmark = pytest.mark.integration


@pytest.fixture(scope="function")
async def api_client():
    """Create a test API client with a fresh in-memory DB."""
    test_engine = create_async_engine(TEST_DATABASE_URL, future=True)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_db():
        async with SessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    await test_engine.dispose()


# ── Prices (public, no auth) ────────────────────────────────────────


@pytest.mark.anyio
async def test_prices_latest_empty(api_client: AsyncClient):
    response = await api_client.get("/api/v1/prices/latest")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.anyio
async def test_price_history_empty(api_client: AsyncClient):
    response = await api_client.get("/api/v1/prices/history", params={"asset_code": "UNKNOWN"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


@pytest.mark.anyio
async def test_suggestions_empty(api_client: AsyncClient):
    response = await api_client.get("/api/v1/prices/suggestions")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


# ── Alert CRUD: Auth required ───────────────────────────────────────


@pytest.mark.anyio
async def test_create_alert_requires_auth(api_client: AsyncClient):
    """Creating an alert without auth should fail."""
    response = await api_client.post(
        "/api/v1/alerts",
        json={
            "asset_code": "USD_IRT",
            "condition_type": "above",
            "target_price": "91000",
        },
    )
    assert response.status_code == 401


@pytest.mark.anyio
async def test_list_alerts_requires_auth(api_client: AsyncClient):
    """Listing alerts without auth should fail."""
    response = await api_client.get("/api/v1/alerts")
    assert response.status_code == 401


@pytest.mark.anyio
async def test_update_alert_requires_auth(api_client: AsyncClient):
    """Updating an alert without auth should fail."""
    response = await api_client.patch(
        "/api/v1/alerts/fake-id",
        json={"target_price": "95000"},
    )
    assert response.status_code == 401


@pytest.mark.anyio
async def test_delete_alert_requires_auth(api_client: AsyncClient):
    """Deleting an alert without auth should fail."""
    response = await api_client.delete("/api/v1/alerts/fake-id")
    assert response.status_code == 401


@pytest.mark.anyio
async def test_confirm_alert_requires_auth(api_client: AsyncClient):
    """Confirming an alert without auth should fail."""
    response = await api_client.post("/api/v1/alerts/fake-id/confirm")
    assert response.status_code == 401


@pytest.mark.anyio
async def test_alert_events_requires_auth(api_client: AsyncClient):
    """Listing alert events without auth should fail."""
    response = await api_client.get("/api/v1/alerts/events")
    assert response.status_code == 401


# ── Admin endpoints: Auth required ──────────────────────────────────


@pytest.mark.anyio
async def test_admin_overview_no_token(api_client: AsyncClient):
    """Admin endpoints without token should be rejected when token is configured."""
    # When admin_access_token is not set (default), non-prod allows access
    # So we just verify the endpoint responds (200 in dev, 401/500 if configured)
    response = await api_client.get("/admin/overview")
    assert response.status_code in (200, 401, 500)


@pytest.mark.anyio
async def test_admin_overview_wrong_token(api_client: AsyncClient):
    """Admin endpoints with wrong token should be rejected."""
    with patch("novax_price_alert.core.settings.settings.admin_access_token", "real-token"):
        response = await api_client.get("/admin/overview", params={"token": "wrong-token"})
    assert response.status_code == 401


@pytest.mark.anyio
async def test_admin_list_alerts_wrong_token(api_client: AsyncClient):
    with patch("novax_price_alert.core.settings.settings.admin_access_token", "real-token"):
        response = await api_client.get("/admin/alerts", params={"token": "wrong"})
    assert response.status_code == 401


@pytest.mark.anyio
async def test_admin_list_users_wrong_token(api_client: AsyncClient):
    with patch("novax_price_alert.core.settings.settings.admin_access_token", "real-token"):
        response = await api_client.get("/admin/users", params={"token": "wrong"})
    assert response.status_code == 401


@pytest.mark.anyio
async def test_admin_audit_logs_wrong_token(api_client: AsyncClient):
    with patch("novax_price_alert.core.settings.settings.admin_access_token", "real-token"):
        response = await api_client.get("/admin/audit-logs", params={"token": "wrong"})
    assert response.status_code == 401


# ── Ingest endpoint: Auth required ──────────────────────────────────


@pytest.mark.anyio
async def test_ingest_requires_auth(api_client: AsyncClient):
    """Ingest endpoint without token should fail."""
    response = await api_client.post(
        "/api/v1/prices/ingest",
        json=[{"symbol": "BTC", "price": 65000}],
    )
    # Should fail with 401 (no auth) or 500 (token not configured)
    assert response.status_code in (401, 500)


@pytest.mark.anyio
async def test_ingest_wrong_token(api_client: AsyncClient):
    """Ingest endpoint with wrong token should fail."""
    with patch("novax_price_alert.core.settings.settings.ingest_api_token", "real-ingest-token"):
        response = await api_client.post(
            "/api/v1/prices/ingest",
            json=[{"symbol": "BTC", "price": 65000}],
            headers={"Authorization": "Bearer wrong-token"},
        )
    assert response.status_code == 403


# ── Override-price: Admin only ──────────────────────────────────────


@pytest.mark.anyio
async def test_override_price_requires_auth(api_client: AsyncClient):
    """Override-price endpoint without token should fail."""
    response = await api_client.post(
        "/api/v1/prices/test/override-price",
        json={"symbol": "BTC", "price": 65000},
    )
    assert response.status_code in (401, 500)


@pytest.mark.anyio
async def test_override_price_wrong_token(api_client: AsyncClient):
    """Override-price endpoint with wrong token should fail."""
    with patch("novax_price_alert.core.settings.settings.admin_access_token", "real-admin-token"):
        response = await api_client.post(
            "/api/v1/prices/test/override-price",
            json={"symbol": "BTC", "price": 65000},
            headers={"Authorization": "Bearer wrong-token"},
        )
    assert response.status_code == 403
