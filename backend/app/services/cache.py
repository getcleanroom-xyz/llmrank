"""Simple in-memory cache with TTL for frequently-called read endpoints."""
import time
import logging

logger = logging.getLogger(__name__)


class TTLCache:
    """In-memory cache with per-key TTL (time-to-live). Thread-safe for a single worker.
    Has max size to prevent memory leaks on Render free tier (512MB)."""

    def __init__(self, default_ttl: int = 15, max_size: int = 500):
        self._store: dict[str, tuple[float, any]] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size

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
        if len(self._store) >= self._max_size and key not in self._store:
            self._evict_expired()
            if len(self._store) >= self._max_size:
                self._evict_oldest()
        expires_at = time.time() + (ttl if ttl is not None else self._default_ttl)
        self._store[key] = (expires_at, value)

    def clear(self, key: str | None = None) -> None:
        if key:
            self._store.pop(key, None)
        else:
            self._store.clear()

    def _evict_expired(self) -> None:
        now = time.time()
        expired = [k for k, (exp, _) in self._store.items() if now > exp]
        for k in expired:
            del self._store[k]

    def _evict_oldest(self) -> None:
        if self._store:
            oldest_key = min(self._store, key=lambda k: self._store[k][0])
            del self._store[oldest_key]


dashboard_cache = TTLCache(default_ttl=30, max_size=200)
