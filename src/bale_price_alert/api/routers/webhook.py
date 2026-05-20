from fastapi import APIRouter

from bale_price_alert.api.schemas.webhook import BaleWebhookIn, BaleWebhookOut
from bale_price_alert.application.services.webhook_service import WebhookService

router = APIRouter(prefix="/bot", tags=["webhook"])


@router.post("/webhook", response_model=BaleWebhookOut)
async def bale_webhook(payload: BaleWebhookIn) -> BaleWebhookOut:
    # استخراج متن و شناسه کاربر بر اساس مدل موجود
    text = payload.message.text if payload.message else None
    user_id = (
        payload.message.from_user.id if payload.message and payload.message.from_user else "unknown"
    )

    service = WebhookService()
    handled, command = await service.handle(text, user_id)

    return BaleWebhookOut(
        success=True,
        handled=handled,
        command=command,
    )
