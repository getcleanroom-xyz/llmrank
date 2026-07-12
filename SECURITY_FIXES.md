# Security & Bug Fix Plan

## CRITICAL

### 1. Credit grant bypass — any user can grant themselves credits
**File:** `backend/app/api/credits.py:27`
**Problem:** `admin_grant_credits` uses `get_current_user` — any authenticated user can call it
**Fix:** Change `user: User = Depends(get_current_user)` to `admin: User = Depends(require_admin)`

### 2. No authentication on 9 endpoints
**Files:** `api/queries.py`, `api/dashboard.py`, `api/drilldown.py`, `api/scans.py`

Add `user: User = Depends(get_current_user)` + brand ownership check to:

| Endpoint | File | Line |
|----------|------|------|
| `GET /brands/{id}/queries/table` | queries.py | 86 |
| `GET /brands/{id}/queries/trend` | queries.py | 152 |
| `POST /brands/{id}/queries/bulk` | queries.py | 223 |
| `POST /brands/{id}/queries/{id}/rescan` | queries.py | 303 |
| `DELETE /brands/{id}/queries/{id}` | queries.py | 71 |
| `GET /brands/{id}/dashboard` | dashboard.py | 28 |
| `GET /brands/{id}/queries/{id}/drilldown` | drilldown.py | 47 |
| `GET /brands/{id}/llms/{name}` | drilldown.py | 130 |
| `GET /brands/{id}/competitors/{name}` | drilldown.py | 203 |
| `GET /brands/{id}/scans/{id}/results` | scans.py | 188 |
| `GET /brands/{id}/scans/{id}/stream` | scans.py | 260 |

For each, add after the function signature:
```python
user: User = Depends(get_current_user),
```
And at the start of the function:
```python
brand_check = await db.execute(Brand.active().where(Brand.id == brand_id, Brand.owner_id == user.id))
if not brand_check.scalar_one_or_none():
    raise HTTPException(404, "Brand not found")
```

### 3. Webhook signature bypass
**File:** `backend/app/services/flutterwave.py:72`
**Problem:** `return True` when `secret_hash` is empty — any webhook accepted
**Fix:** Change `return True` to `return False`

### 4. Raw SQL tool reads any table
**File:** `backend/app/services/tools/db.py:48`
**Problem:** `query_db` accepts arbitrary SQL — prompt injection can read users, passkeys, wallets
**Fix:** Add table whitelist before executing:
```python
import re
ALLOWED_TABLES = {"brands", "monitored_queries", "scans", "query_results", "conversations", "chat_messages"}

# After normalizing the query:
table_refs = set(re.findall(r'(?:FROM|JOIN)\s+(\w+)', normalized, re.IGNORECASE))
disallowed = table_refs - ALLOWED_TABLES
if disallowed:
    raise ValueError(f"Query references disallowed tables: {disallowed}. Allowed: {ALLOWED_TABLES}")
```

### 5. Syntax error in manage_queries.py
**File:** `backend/app/services/skills/manage_queries.py:49-55`
**Problem:** Duplicate/orphaned prompt lines after the `prompt = (...)` assignment
**Fix:** Delete lines 49-55 (the orphaned `f"RULES:\n"` block that appears after the prompt closing paren)

### 6. Credit refund on failed scans never works
**File:** `backend/app/api/scans.py:124-144`
**Problem:** ILIKE pattern `f"%Scan: %{scan_id}%"` doesn't match the actual description format
**Fix:** Store the `credit_tx_id` when deducting credits, pass it to background task, and look up by ID:
- In `trigger_scan`, after `deduct_credits`, capture the returned tx_id
- Pass tx_id to `_run_scan_background`
- In background task, look up `CreditTransaction.id == tx_id` instead of ILIKE

---

## HIGH

### 7. Default SECRET_KEY allows session forgery
**File:** `backend/app/core/config.py:7`
**Problem:** `SECRET_KEY: str = "dev-secret-change-in-production"` — if not overridden, anyone can forge sessions
**Fix:** Add to Settings class:
```python
from pydantic import model_validator
import secrets

@model_validator(mode="after")
def _check_secret_key(self):
    if self.SECRET_KEY == "dev-secret-change-in-production":
        logger.warning("SECRET_KEY is default — generating random key for this session")
        self.SECRET_KEY = secrets.token_hex(32)
    return self
```

### 8. Credit double-spend race condition
**File:** `backend/app/services/credit_service.py:88-106`
**Problem:** `check_credits` and `deduct_credits` are separate calls with no row locking
**Fix:** Use `SELECT ... FOR UPDATE` in `deduct_credits`:
```python
result = await db.execute(
    select(CreditWallet).where(CreditWallet.user_id == user_id).with_for_update()
)
```

### 9. CSV upload no size limit
**File:** `backend/app/api/campaign_audience.py:32`
**Problem:** `await file.read()` loads entire file into memory — DoS vector
**Fix:** Add after getting the file:
```python
if file.size and file.size > 5 * 1024 * 1024:
    raise HTTPException(413, "File too large (max 5MB)")
```

### 10. Admin user listing no pagination
**File:** `backend/app/api/admin.py:42-51`
**Fix:** Add `page: int = 1, per_page: int = 50` params, use `.offset().limit()`

### 11. Message listing no pagination
**File:** `backend/app/api/conversations.py:198-203`
**Fix:** Add `limit: int = 100, offset: int = 0` params, use `.offset().limit()`

### 12. SSE stream holds DB connection 60 seconds
**File:** `backend/app/api/scans.py:260-293`
**Problem:** `stream_scan_progress` opens one session and polls for 60s
**Fix:** Create a new session per poll iteration instead of reusing one

### 13. Credit grant race condition (webhook + verify double-grant)
**File:** `backend/app/api/payments.py:94-202`
**Fix:** Use `SELECT ... FOR UPDATE` on the wallet before granting, or add unique constraint on transaction reference

---

## MEDIUM

### 14. Rate limiting uses IP only
**File:** `backend/app/core/rate_limit.py:4`
**Fix:** For authenticated routes, use user ID from session cookie instead of IP

### 15. Error messages leak internals
**File:** `backend/app/api/webauthn.py:79`
**Fix:** Replace `f"Registration failed: {str(e)}"` with generic message, log full error server-side

### 16. CORS too permissive
**File:** `backend/app/main.py:122-124`
**Fix:** Change `allow_methods=["*"]` to `allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`

### 17. Pending registration unbounded
**File:** `backend/app/api/auth.py:68-79`
**Fix:** Use `TTLCache(maxsize=1000, ttl=600)` instead of plain dict, or add periodic cleanup

### 18. Event log grows forever
**File:** `backend/app/services/event_bus/broker.py:50`
**Fix:** Change `self._event_log: list[Event] = []` to `collections.deque(maxlen=500)`

### 19. Fire-and-forget insights
**File:** `backend/app/api/dashboard.py:218`
**Fix:** Add try/except with logging inside `_compute_and_cache_insights`

### 20. N+1 in score_queries
**File:** `backend/app/services/skills/manage_queries.py:101-108`
**Fix:** Batch-fetch latest results with a single query using window function or subquery

### 21. Connection pool too small
**File:** `backend/app/core/database.py:5`
**Fix:** Change `pool_size=3, max_overflow=5` to `pool_size=10, max_overflow=10`

### 22. Event log OOM
**File:** `backend/app/services/event_bus/broker.py:50`
**Fix:** `collections.deque(maxlen=500)`

### 23. Campaign flushes per-recipient
**File:** `backend/app/services/campaign_scheduler.py:81-95`
**Fix:** Batch status updates, flush once after the loop

### 24. query_trend loads all results
**File:** `backend/app/api/queries.py:167-220`
**Fix:** Compute aggregation in SQL with GROUP BY instead of Python

### 25. Event bus sequential delivery
**File:** `backend/app/services/event_bus/broker.py:80`
**Fix:** Use `asyncio.gather()` or `asyncio.create_task()` for concurrent delivery
