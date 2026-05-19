import pytest
from sqlalchemy import select

from bale_price_alert.db.models import HealthCheckLog


@pytest.mark.anyio
async def test_health_check_table(db_session) -> None:
    session = db_session

    obj = HealthCheckLog.new()
    session.add(obj)
    await session.commit()

    result = await session.scalar(select(HealthCheckLog.status))

    assert result == "ok"
