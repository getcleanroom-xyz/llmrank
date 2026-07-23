"""In-memory scan progress store for real-time SSE streaming."""
import time
import threading
from dataclasses import dataclass, field


@dataclass
class ScanProgress:
    scan_id: str
    status: str = "pending"
    step: str = ""
    message: str = ""
    progress: int = 0
    visibility_score: float | None = None
    mention_rate: float | None = None
    updated_at: float = field(default_factory=time.time)


_lock = threading.Lock()
_store: dict[str, ScanProgress] = {}


def set_progress(scan_id: str, **kwargs) -> None:
    with _lock:
        if scan_id not in _store:
            _store[scan_id] = ScanProgress(scan_id=scan_id)
        p = _store[scan_id]
        for k, v in kwargs.items():
            setattr(p, k, v)
        p.updated_at = time.time()


def get_progress(scan_id: str) -> ScanProgress | None:
    with _lock:
        return _store.get(scan_id)


def clear_progress(scan_id: str) -> None:
    with _lock:
        _store.pop(scan_id, None)


def cleanup_stale(max_age: float = 300.0) -> None:
    """Remove entries older than max_age seconds."""
    now = time.time()
    with _lock:
        stale = [sid for sid, p in _store.items() if now - p.updated_at > max_age]
        for sid in stale:
            del _store[sid]
