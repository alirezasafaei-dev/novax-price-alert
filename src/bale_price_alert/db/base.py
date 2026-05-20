# src/bale_price_alert/db/base.py
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

if TYPE_CHECKING:
    # این برای ابزارهای type checker مثل mypy و IDEهاست
    from bale_price_alert.db import models  # noqa: F401


class Base(DeclarativeBase):
    """Declarative Base for all models."""

    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class UUIDPrimaryKeyMixin:
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )


# در زمان اجرا، مدل‌ها را لود کن تا در Base.metadata ثبت شوند
# noqa: F401 باعث می‌شود Ruff بداند این import عمداً استفاده نشده است
from bale_price_alert.db import models  # noqa: F401,E402
