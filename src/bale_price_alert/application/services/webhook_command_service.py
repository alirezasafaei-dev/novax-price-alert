from typing import Optional, Tuple


class WebhookCommandService:
    COMMANDS = {"/start", "/help", "/prices", "/alert"}

    async def handle(self, text: Optional[str], user_id: str) -> Tuple[bool, str, list[str]]:
        """
        Returns: (handled, command, args)
        """
        if not text or not text.startswith("/"):
            return False, "", []

        parts = text.split()
        cmd = parts[0].lower()
        args = parts[1:]

        if cmd in self.COMMANDS:
            # اینجا در آینده سرویس‌های دیگر (مثل alert_crud_service) فراخوانی می‌شوند
            return True, cmd, args

        return False, cmd, args
