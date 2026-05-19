import asyncio

from sqlalchemy import select

from bale_price_alert.db.models import HealthCheckLog
from bale_price_alert.db.session import AsyncSessionLocal


async def _insert_and_fetch() -> str:
    async with AsyncSessionLocal() as session:
        obj = HealthCheckLog.new()
        session.add(obj)
        await session.commit()
        result = await session.scalar(select(HealthCheckLog.status))
        return result


def test_health_check_table() -> None:
    result = asyncio.run(_insert_and_fetch())
    assert result == "ok"
