import logging
from collections import Counter
from collections.abc import Mapping
from time import perf_counter
from typing import Any

import redis
from redis.exceptions import RedisError

from novax_price_alert.core.settings import settings
from novax_price_alert.infra.cache import PriceCache

logger = logging.getLogger("novax_price_alert.lifecycle")
metrics: Counter[str] = Counter()
_metrics_cache: PriceCache | None = None
_redis_client = None

def _get_redis() -> "redis.Redis | None":
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if not settings.redis_url:
        return None
    try:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        _redis_client = None
    return _redis_client

def _get_metrics_cache() -> PriceCache | None:
    global _metrics_cache
    if _metrics_cache is not None:
        return _metrics_cache
    if settings.redis_url:
        try:
            _metrics_cache = PriceCache(settings.redis_url, ttl_seconds=3600)
        except Exception:
            _metrics_cache = None
    return _metrics_cache


def record_metric(name: str, value: int = 1) -> None:
    metrics[name] += value
    r = _get_redis()
    if r is not None:
        try:
            r.incr(f"metrics:counter:{name}", value)
        except RedisError:
            pass


def get_metrics_snapshot() -> dict[str, int]:
    snap = dict(sorted(metrics.items()))
    r = _get_redis()
    if r is not None:
        try:
            # flush in-memory to redis for persistence
            for k, v in metrics.items():
                try:
                    r.incr(f"metrics:counter:{k}", v)
                except Exception:
                    pass
            keys = r.keys("metrics:counter:*")
            for key in keys:
                try:
                    k = key.replace("metrics:counter:", "")
                    v = int(r.get(key) or 0)
                    snap[k] = snap.get(k, 0) + v
                except Exception:
                    pass
        except RedisError:
            pass
    return snap


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
