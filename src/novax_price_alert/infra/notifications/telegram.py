from __future__ import annotations

from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from novax_price_alert.domain.alert_event import AlertEvent
from novax_price_alert.domain.alert_rule import AlertRule
from novax_price_alert.domain.asset import Asset
from novax_price_alert.domain.user import User
from novax_price_alert.infra.notifications.base import BaseNotificationSender


class TelegramNotificationSender(BaseNotificationSender):
    def __init__(
        self,
        *,
        bot_token: str,
        session: AsyncSession,
        timeout_seconds: int,
        relay_url: str = "",
        relay_secret: str = "",
    ) -> None:
        self.bot_token = bot_token
        self.session = session
        self.timeout_seconds = timeout_seconds
        self.relay_url = relay_url.rstrip("/")
        self.relay_secret = relay_secret

    async def send(self, event: AlertEvent) -> None:
        if not self.bot_token:
            raise RuntimeError("Telegram bot token is not configured")

        stmt = (
            select(AlertRule, User, Asset)
            .join(User, User.id == AlertRule.user_id)
            .join(Asset, Asset.id == AlertRule.asset_id)
            .where(AlertRule.id == event.alert_rule_id)
        )
        result = await self.session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            raise RuntimeError("alert rule for event was not found")
        rule, user, asset = row
        chat_id = user.telegram_user_id

        display_name = asset.display_name or asset.name or asset.symbol or rule.canonical_asset_id
        condition_text = "بالاتر یا مساوی" if rule.condition_type == "above" else "پایین‌تر یا مساوی"
        unit = asset.unit or rule.target_price_display_unit or ""

        text = (
            "🔔 هشدار قیمت NovaX فعال شد\n\n"
            f"دارایی: {display_name} ({rule.canonical_asset_id or ''})\n"
            f"شرط: {condition_text} {rule.target_price:,} {unit}\n"
            f"قیمت تریگر: {event.triggered_price:,} {unit}\n\n"
            "هشدار شما اجرا شد. برای مدیریت بیشتر از دکمه‌ها استفاده کنید."
        )

        # Rich inline keyboard for triggered notification (roadmap فاز ۱).
        # Uses url buttons (widely supported). Full callback actions
        # (disable/edit) can be wired in CF worker later.
        app_url = "https://novax.alirezasafeidev.ir"
        reply_markup = {
            "inline_keyboard": [
                [
                    {"text": "📈 چارت و قیمت‌ها در اپ", "url": app_url},
                    {"text": "🔔 مدیریت هشدارها", "url": app_url},
                ],
                [
                    {"text": "📋 باز کردن Alert Studio (تستی)", "url": app_url},
                ],
            ]
        }

        payload = await self._send_message(chat_id=chat_id, text=text, reply_markup=reply_markup)
        telegram_result = payload.get("result")
        message_id = (
            telegram_result.get("message_id") if isinstance(telegram_result, dict) else None
        )
        if message_id is not None:
            event.telegram_message_id = str(message_id)

    async def _send_message(
        self, *, chat_id: str, text: str, reply_markup: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        if self.relay_url:
            headers = {"X-Relay-Secret": self.relay_secret} if self.relay_secret else {}
            async with httpx.AsyncClient(timeout=self.timeout_seconds, trust_env=False) as client:
                response = await client.post(
                    f"{self.relay_url}/send",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
            relay_payload = response.json()
            if isinstance(relay_payload, dict):
                return relay_payload
            raise RuntimeError("telegram relay returned an invalid response")

        async with httpx.AsyncClient(timeout=self.timeout_seconds, trust_env=False) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json=payload,
            )
            response.raise_for_status()
        resp_payload = response.json()
        if isinstance(resp_payload, dict):
            return resp_payload
        raise RuntimeError("telegram api returned an invalid response")
