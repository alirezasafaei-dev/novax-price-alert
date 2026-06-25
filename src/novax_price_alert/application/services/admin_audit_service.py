import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.domain.admin_audit import AdminAuditLog


class AdminAuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log_action(
        self,
        action: str,
        target_type: str | None = None,
        target_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> AdminAuditLog:
        log = AdminAuditLog(
            id=str(uuid.uuid4()),
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
            performed_at=datetime.now(timezone.utc),
            actor="owner",
        )
        self.session.add(log)
        await self.session.commit()
        return log

    async def list_recent(self, limit: int = 50) -> list[AdminAuditLog]:
        stmt = select(AdminAuditLog).order_by(desc(AdminAuditLog.performed_at)).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())
