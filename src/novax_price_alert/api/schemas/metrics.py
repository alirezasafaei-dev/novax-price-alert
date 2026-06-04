from pydantic import BaseModel


class MetricsOut(BaseModel):
    metrics: dict[str, int]
