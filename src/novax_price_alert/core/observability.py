import logging
from collections import Counter
from collections.abc import Mapping
from time import perf_counter
from typing import Any

logger = logging.getLogger("novax_price_alert.lifecycle")
metrics: Counter[str] = Counter()


def record_metric(name: str, value: int = 1) -> None:
    metrics[name] += value


def get_metrics_snapshot() -> dict[str, int]:
    return dict(sorted(metrics.items()))


def emit_event(event_name: str, **fields: Any) -> None:
    payload = {"event_name": event_name, **fields}
    logger.info(event_name, extra=payload)


class latency_timer:
    def __init__(self, metric_name: str, fields: Mapping[str, Any] | None = None) -> None:
        self.metric_name = metric_name
        self.fields = dict(fields or {})
        self.started_at = 0.0

    def __enter__(self) -> "latency_timer":
        self.started_at = perf_counter()
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        elapsed_ms = int((perf_counter() - self.started_at) * 1000)
        record_metric(self.metric_name)
        emit_event("worker_processing_latency", latency_ms=elapsed_ms, **self.fields)
