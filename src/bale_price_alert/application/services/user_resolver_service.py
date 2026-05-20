from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bale_price_alert.domain.asset import Asset
from bale_price_alert.domain.user import User


class UserResolverService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def resolve_user(self, bale_user_id: str) -> User | None:
        stmt = select(User).where(User.bale_user_id == bale_user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def resolve_asset(self, asset_symbol: str) -> Asset | None:
        stmt = select(Asset).where(Asset.symbol == asset_symbol)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
