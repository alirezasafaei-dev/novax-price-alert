from __future__ import annotations

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
        text = (
            "🔔 هشدار قیمت فعال شد\n"
            f"دارایی: {asset.display_name or asset.name}\n"
            f"شرط: {'بالاتر یا مساوی' if rule.condition_type == 'above' else 'پایین‌تر یا مساوی'} "
            f"{rule.target_price:,}\n"
            f"قیمت فعلی: {event.triggered_price:,} {asset.unit}"
        )

        payload = await self._send_message(chat_id=chat_id, text=text)
        telegram_result = payload.get("result")
        message_id = (
            telegram_result.get("message_id") if isinstance(telegram_result, dict) else None
        )
        if message_id is not None:
            event.telegram_message_id = str(message_id)

    async def _send_message(self, *, chat_id: str, text: str) -> dict[str, object]:
        if self.relay_url:
            headers = {"X-Relay-Secret": self.relay_secret} if self.relay_secret else {}
            async with httpx.AsyncClient(timeout=self.timeout_seconds, trust_env=False) as client:
                response = await client.post(
                    f"{self.relay_url}/send",
                    headers=headers,
                    json={"chat_id": chat_id, "text": text},
                )
                response.raise_for_status()
            relay_payload = response.json()
            if isinstance(relay_payload, dict):
                return relay_payload
            raise RuntimeError("telegram relay returned an invalid response")

        async with httpx.AsyncClient(timeout=self.timeout_seconds, trust_env=False) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": text},
            )
            response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict):
            return payload
        raise RuntimeError("telegram api returned an invalid response")
