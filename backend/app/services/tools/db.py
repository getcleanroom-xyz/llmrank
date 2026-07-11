"""Database tools — secure, parameterized database operations for agents."""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Model name → ORM class mapping (lazy import to avoid circular deps)
_MODEL_REGISTRY: dict[str, type] | None = None


def _get_model_registry() -> dict[str, type]:
    """Lazy-load model registry to avoid circular imports."""
    global _MODEL_REGISTRY
    if _MODEL_REGISTRY is None:
        from app.models.models import (
            Brand, MonitoredQuery, Scan, QueryResult,
            User, CreditWallet, CreditTransaction,
            Campaign, CampaignRecipient,
            Conversation, ChatMessage,
            BrandAgentContext, AgentRateLimit,
        )
        _MODEL_REGISTRY = {
            "Brand": Brand,
            "MonitoredQuery": MonitoredQuery,
            "Scan": Scan,
            "QueryResult": QueryResult,
            "User": User,
            "CreditWallet": CreditWallet,
            "CreditTransaction": CreditTransaction,
            "Campaign": Campaign,
            "CampaignRecipient": CampaignRecipient,
            "Conversation": Conversation,
            "ChatMessage": ChatMessage,
            "BrandAgentContext": BrandAgentContext,
            "AgentRateLimit": AgentRateLimit,
        }
    return _MODEL_REGISTRY


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def query_db(sql: str, params: dict | None = None, db: AsyncSession | None = None) -> list[dict]:
    """Execute a read-only SQL query and return results as list of dicts.

    Security:
    - Parameterized queries only (no string interpolation)
    - READ-ONLY: rejects INSERT/UPDATE/DELETE/DROP/TRUNCATE/ALTER
    - Results limited to 1000 rows
    """
    from app.core.database import AsyncSessionLocal

    # Security: reject write operations
    normalized = sql.strip().upper()
    forbidden = ("INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE")
    for word in forbidden:
        if normalized.startswith(word) or f" {word} " in normalized:
            raise ValueError(f"Query contains forbidden operation: {word}")

    # Add LIMIT if not present
    if "LIMIT" not in normalized:
        sql = sql.rstrip().rstrip(";") + " LIMIT 1000"

    async def _execute(session: AsyncSession):
        result = await session.execute(text(sql), params or {})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        return await _execute(session)


async def read_model(model_name: str, filters: dict | None = None,
                     limit: int = 100, offset: int = 0,
                     order_by: str | None = None, ascending: bool = True,
                     db: AsyncSession | None = None) -> list[dict]:
    """Read records from a model with filters. Returns list of dicts.

    Security:
    - Only whitelisted model names accepted
    - Filters validated against model columns
    """
    from app.core.database import AsyncSessionLocal

    registry = _get_model_registry()
    model_class = registry.get(model_name)
    if not model_class:
        raise ValueError(f"Unknown model: {model_name}. Allowed: {list(registry.keys())}")

    async def _execute(session: AsyncSession):
        stmt = select(model_class)

        # Apply filters
        if filters:
            for key, value in filters.items():
                if hasattr(model_class, key):
                    stmt = stmt.where(getattr(model_class, key) == value)
                else:
                    raise ValueError(f"Model {model_name} has no column: {key}")

        # Apply ordering
        if order_by and hasattr(model_class, order_by):
            col = getattr(model_class, order_by)
            stmt = stmt.order_by(col.asc() if ascending else col.desc())

        stmt = stmt.offset(offset).limit(limit)
        result = await session.execute(stmt)
        rows = result.scalars().all()

        return [
            {c.name: getattr(row, c.name) for c in row.__table__.columns}
            for row in rows
        ]

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        return await _execute(session)


async def write_model(model_name: str, data: dict, allowed_fields: list[str] | None = None,
                      db: AsyncSession | None = None) -> dict:
    """Create or update a model record with validated fields.

    Security:
    - Only whitelisted model names accepted
    - Only allowed_fields can be written (if specified)
    - UUID fields auto-generated for new records
    - timestamps auto-managed
    """
    from app.core.database import AsyncSessionLocal

    registry = _get_model_registry()
    model_class = registry.get(model_name)
    if not model_class:
        raise ValueError(f"Unknown model: {model_name}. Allowed: {list(registry.keys())}")

    # Filter to allowed fields only
    if allowed_fields:
        data = {k: v for k, v in data.items() if k in allowed_fields}

    # Validate that all fields exist on the model
    valid_columns = {c.name for c in model_class.__table__.columns}
    invalid = set(data.keys()) - valid_columns
    if invalid:
        raise ValueError(f"Invalid fields for {model_name}: {invalid}")

    async def _execute(session: AsyncSession):
        # Check if this is an update (has 'id') or create
        record_id = data.get("id")
        if record_id:
            from sqlalchemy import update as sa_update
            stmt = (
                sa_update(model_class)
                .where(model_class.id == record_id)
                .values(**data)
            )
            await session.execute(stmt)
            await session.flush()

            # Re-read to return
            result = await session.execute(
                select(model_class).where(model_class.id == record_id)
            )
            row = result.scalar_one_or_none()
            if row:
                return {c.name: getattr(row, c.name) for c in row.__table__.columns}
            return data
        else:
            # Create new record
            if "id" not in data:
                data["id"] = uuid.uuid4()
            if "created_at" not in data and hasattr(model_class, "created_at"):
                data["created_at"] = _utcnow()

            instance = model_class(**data)
            session.add(instance)
            await session.flush()

            return {c.name: getattr(instance, c.name) for c in instance.__table__.columns}

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        result = await _execute(session)
        await session.commit()
        return result


async def count_records(model_name: str, filters: dict | None = None,
                        db: AsyncSession | None = None) -> int:
    """Count records matching filters. READ-ONLY."""
    from app.core.database import AsyncSessionLocal

    registry = _get_model_registry()
    model_class = registry.get(model_name)
    if not model_class:
        raise ValueError(f"Unknown model: {model_name}")

    async def _execute(session: AsyncSession):
        stmt = select(func.count()).select_from(model_class)
        if filters:
            for key, value in filters.items():
                if hasattr(model_class, key):
                    stmt = stmt.where(getattr(model_class, key) == value)
        result = await session.execute(stmt)
        return result.scalar() or 0

    if db:
        return await _execute(db)

    async with AsyncSessionLocal() as session:
        return await _execute(session)
