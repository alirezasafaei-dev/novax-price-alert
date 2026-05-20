from typing import Optional, Tuple


class WebhookService:
    COMMANDS = {"/start", "/help", "/prices", "/alert"}

    async def handle(self, text: Optional[str], user_id: str) -> Tuple[bool, Optional[str]]:
        if not text or not text.startswith("/"):
            return False, None

        cmd = text.split()[0].lower()
        if cmd in self.COMMANDS:
            return True, cmd

        return False, None
