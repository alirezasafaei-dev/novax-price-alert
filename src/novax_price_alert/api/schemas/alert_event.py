from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class AlertEventOut(BaseModel):
    id: str
    alert_id: str
    asset_code: str | None = None
    asset_name: str | None = None
    status: str
    triggered_price: Decimal
    triggered_at: datetime
    sent_at: datetime | None = None
    error_message: str | None = None


class AlertEventListOut(BaseModel):
    items: list[AlertEventOut]
