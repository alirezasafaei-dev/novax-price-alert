from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class AlertCondition(str, Enum):
    ABOVE = "above"
    BELOW = "below"


class AlertLifecycleState(str, Enum):
    DRAFT = "draft"
    AWAITING_CONDITION = "awaiting_condition"
    AWAITING_TARGET_PRICE = "awaiting_target_price"
    PENDING_CONFIRMATION = "pending_confirmation"
    ACTIVE = "active"
    TRIGGERED = "triggered"
    DELIVERY_IN_PROGRESS = "delivery_in_progress"
    DELIVERED = "delivered"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    FAILED = "failed"


class AlertCreateIn(BaseModel):
    asset_code: str
    condition_type: AlertCondition
    target_price: Decimal = Field(gt=0)
    cooldown_minutes: int = Field(default=60, ge=0)
    confirm: bool = False


class AlertUpdateIn(BaseModel):
    target_price: Decimal | None = Field(default=None, gt=0)
    cooldown_minutes: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    asset_id: str
    asset_code: str | None = None
    asset_name: str | None = None
    display_asset_name_at_creation: str | None = None
    condition_type: AlertCondition
    target_price: Decimal
    target_price_display_unit: str
    lifecycle_state: AlertLifecycleState
    is_active: bool
    cooldown_minutes: int
    last_triggered_at: datetime | None
    confirmed_at: datetime | None = None
    triggered_at: datetime | None = None
    delivered_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AlertListOut(BaseModel):
    items: list[AlertOut]


class DeleteAlertOut(BaseModel):
    success: bool = True
