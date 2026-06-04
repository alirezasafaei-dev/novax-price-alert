from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.user import User


class UserResolverService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def resolve_user(self, telegram_user_id: str) -> User | None:
        stmt = select(User).where(User.telegram_user_id == telegram_user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def resolve_asset(self, asset_symbol: str) -> Asset | None:
        stmt = select(Asset).where(
            or_(Asset.symbol == asset_symbol, Asset.canonical_id == asset_symbol)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
