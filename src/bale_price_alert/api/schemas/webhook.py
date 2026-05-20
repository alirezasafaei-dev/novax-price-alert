from pydantic import BaseModel


class BaleUserOut(BaseModel):
    id: str
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None


class BaleChatOut(BaseModel):
    id: str


class BaleMessageOut(BaseModel):
    text: str | None = None
    from_user: BaleUserOut | None = None
    chat: BaleChatOut | None = None


class BaleWebhookIn(BaseModel):
    message: BaleMessageOut | None = None


class BaleWebhookOut(BaseModel):
    success: bool = True
    handled: bool = False
    command: str | None = None
