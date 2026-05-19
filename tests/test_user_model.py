import asyncio
import uuid

from bale_price_alert.db.models import User
from bale_price_alert.db.session import AsyncSessionLocal


async def _create_user() -> str:
    async with AsyncSessionLocal() as session:
        user = User(
            bale_user_id=str(uuid.uuid4()),
            username="test",
        )

        session.add(user)
        await session.commit()
        await session.refresh(user)

        return user.bale_user_id


def test_create_user() -> None:
    result = asyncio.run(_create_user())
    assert result is not None
