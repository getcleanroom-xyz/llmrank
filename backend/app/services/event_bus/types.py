"""Event types and data classes."""
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@dataclass
class Event:
    """An event published to the bus."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    topic: str = ""
    event_type: str = ""
    payload: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "topic": self.topic, "event_type": self.event_type,
            "payload": self.payload, "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Event":
        created_at = data.get("created_at", _utcnow())
        if isinstance(created_at, str):
            from datetime import datetime
            try:
                created_at = datetime.fromisoformat(created_at)
            except (ValueError, TypeError):
                created_at = _utcnow()
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            topic=data.get("topic", ""),
            event_type=data.get("event_type", ""),
            payload=data.get("payload", {}),
            metadata=data.get("metadata", {}),
            created_at=created_at,
        )
