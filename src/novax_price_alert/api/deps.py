from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.api.errors import UnauthorizedError
from novax_price_alert.api.i18n import AUTH_TELEGRAM_INIT_DATA_REQUIRED
from novax_price_alert.core.settings import settings
from novax_price_alert.core.telegram_auth import TelegramAuthError, verify_telegram_init_data
from novax_price_alert.db.session import AsyncSessionLocal
from novax_price_alert.domain.user import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_current_telegram_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_telegram_init_data: str | None = Header(default=None),
) -> User:
    return await _resolve_current_telegram_user(x_telegram_init_data, db)


async def _resolve_current_telegram_user(
    init_data: str | None,
    db: AsyncSession,
) -> User:
    if not init_data:
        raise UnauthorizedError(AUTH_TELEGRAM_INIT_DATA_REQUIRED)
    try:
        telegram_user = verify_telegram_init_data(
            init_data,
            bot_token=settings.telegram_bot_token,
            max_age_seconds=settings.telegram_auth_max_age_seconds,
        )
    except (TelegramAuthError, ValueError) as exc:
        raise UnauthorizedError(str(exc)) from exc

    result = await db.execute(
        select(User).where(User.telegram_user_id == telegram_user.telegram_user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            telegram_user_id=telegram_user.telegram_user_id,
        )
        db.add(user)
    user.username = telegram_user.username
    user.first_name = telegram_user.first_name
    user.last_name = telegram_user.last_name
    user.language_code = telegram_user.language_code
    await db.commit()
    await db.refresh(user)
    return user
