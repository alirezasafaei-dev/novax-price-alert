from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.db.session import get_db

router = APIRouter()


@router.get("/health")
async def health(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Health check endpoint with database connectivity verification."""
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0",
    }
