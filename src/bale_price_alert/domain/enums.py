from enum import StrEnum


class AlertCondition(StrEnum):
    ABOVE = "above"
    BELOW = "below"


class AlertEventStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
