from __future__ import annotations

import importlib
import json
from typing import Any


class PriceCache:
    def __init__(self, redis_url: str, ttl_seconds: int) -> None:
        self.redis_url = redis_url
        self.ttl_seconds = ttl_seconds
        self._memory: dict[str, str] = {}
        self._redis: Any | None = None

    async def get_json(self, key: str) -> dict[str, Any] | None:
        value: str | bytes | None
        redis = self._get_redis()
        if redis is not None:
            value = await redis.get(key)
        else:
            value = self._memory.get(key)
        if value is None:
            return None
        if isinstance(value, bytes):
            value = value.decode()
        decoded = json.loads(value)
        if not isinstance(decoded, dict):
            return None
        return decoded

    async def set_json(self, key: str, value: dict[str, Any]) -> None:
        payload = json.dumps(value, default=str)
        redis = self._get_redis()
        if redis is not None:
            await redis.set(key, payload, ex=self.ttl_seconds)
            return
        self._memory[key] = payload

    def _get_redis(self) -> Any | None:
        if self._redis is not None:
            return self._redis
        if not self.redis_url:
            return None
        try:
            redis_module = importlib.import_module("redis.asyncio")
            self._redis = redis_module.Redis.from_url(self.redis_url, decode_responses=True)
        except Exception:
            self._redis = None
        return self._redis

    async def acquire_lock(self, key: str, value: str, ttl_ms: int = 30000) -> bool:
        """Distributed lock using SET NX PX. Returns True if acquired."""
        redis = self._get_redis()
        if redis is None:
            return True  # no redis -> best effort, allow
        try:
            return bool(await redis.set(key, value, nx=True, px=ttl_ms))
        except Exception:
            return True

    async def release_lock(self, key: str, value: str) -> None:
        """Release lock only if value matches (using Lua for atomicity)."""
        redis = self._get_redis()
        if redis is None:
            return
        try:
            lua = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            await redis.eval(lua, 1, key, value)
        except Exception:
            pass
