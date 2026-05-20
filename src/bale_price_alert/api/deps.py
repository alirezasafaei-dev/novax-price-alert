from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.db.session import AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
