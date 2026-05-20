import pytest
from httpx import AsyncClient

from bale_price_alert.api.main import app


@pytest.mark.asyncio
async def test_prices_endpoint():

    async with AsyncClient(app=app, base_url="http://test") as client:

        response = await client.get("/api/v1/prices/latest")

        assert response.status_code == 200
