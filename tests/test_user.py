import uuid

import pytest

from bale_price_alert.db.models import User


@pytest.mark.anyio
async def test_create_user(db_session) -> None:
    session = db_session

    user = User(
        bale_user_id=str(uuid.uuid4()),
        username="test",
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    assert user.bale_user_id is not None
