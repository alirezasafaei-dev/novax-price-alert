import httpx
import pytest

from novax_price_alert.infra.notifications.telegram import TelegramNotificationSender


@pytest.mark.anyio
async def test_telegram_sender_uses_relay_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_post(self: object, url: str, **kwargs: object) -> httpx.Response:
        captured["url"] = url
        captured["kwargs"] = kwargs
        return httpx.Response(
            200,
            json={"ok": True, "result": {"message_id": 123}},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    sender = TelegramNotificationSender(
        bot_token="unused-on-relay",
        session=None,  # type: ignore[arg-type]
        timeout_seconds=10,
        relay_url="https://relay.example.workers.dev/",
        relay_secret="secret",
    )
    payload = await sender._send_message(chat_id="42", text="hello")

    assert captured["url"] == "https://relay.example.workers.dev/send"
    assert captured["kwargs"] == {
        "headers": {"X-Relay-Secret": "secret"},
        "json": {
            "chat_id": "42",
            "text": "hello",
            "disable_web_page_preview": True,
        },
    }
    assert payload["ok"] is True
