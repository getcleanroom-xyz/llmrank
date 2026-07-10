"""Simple in-memory cache with TTL for frequently-called read endpoints."""
import time
import logging

logger = logging.getLogger(__name__)


class TTLCache:
    """In-memory cache with per-key TTL (time-to-live). Thread-safe for a single worker."""

    def __init__(self, default_ttl: int = 15):
        self._store: dict[str, tuple[float, any]] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> any:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: any, ttl: int | None = None) -> None:
        expires_at = time.time() + (ttl if ttl is not None else self._default_ttl)
        self._store[key] = (expires_at, value)

    def clear(self, key: str | None = None) -> None:
        if key:
            self._store.pop(key, None)
        else:
            self._store.clear()


dashboard_cache = TTLCache(default_ttl=30)
