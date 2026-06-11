import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.domain.admin_audit import AdminAuditLog


class AdminAuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _ensure_table(self) -> None:
        # Production note: proper Alembic migration recommended.
        # This is a safe bootstrap for the admin audit log table.
        try:
            await self.session.execute(
                text("""
                CREATE TABLE IF NOT EXISTS admin_audit_logs (
                    id TEXT PRIMARY KEY,
                    action TEXT NOT NULL,
                    target_type TEXT,
                    target_id TEXT,
                    details JSONB DEFAULT '{}'::jsonb,
                    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    actor TEXT DEFAULT 'owner'
                )
            """)
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()

    async def log_action(
        self,
        action: str,
        target_type: str | None = None,
        target_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> AdminAuditLog:
        await self._ensure_table()
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
        await self._ensure_table()
        stmt = select(AdminAuditLog).order_by(desc(AdminAuditLog.performed_at)).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())
