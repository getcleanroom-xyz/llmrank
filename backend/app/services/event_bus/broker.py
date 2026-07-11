"""EventBroker — publish/subscribe event bus with Postgres persistence and DLQ."""
import uuid
import asyncio
import logging
from typing import Callable, Awaitable
from datetime import datetime, timezone

from app.services.event_bus.types import Event

logger = logging.getLogger(__name__)

EventHandler = Callable[[Event], Awaitable[None]]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Subscription:
    """A named subscription to a topic with optional event type filter."""

    def __init__(self, name: str, handler: EventHandler, event_types: list[str] | None = None,
                 max_retries: int = 3, retry_delay: float = 1.0):
        self.name = name
        self.handler = handler
        self.event_types = event_types  # None = all events on topic
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.paused = False

    def matches(self, event: Event) -> bool:
        if self.paused:
            return False
        if self.event_types and event.event_type not in self.event_types:
            return False
        return True

    def pause(self):
        self.paused = True

    def resume(self):
        self.paused = False


class EventBus:
    """In-process event broker with optional Postgres persistence and DLQ."""

    def __init__(self):
        self._subscriptions: dict[str, list[Subscription]] = {}
        self._event_log: list[Event] = []  # in-memory event log

    def subscribe(self, topic: str, handler: EventHandler, name: str = "",
                  event_types: list[str] | None = None,
                  max_retries: int = 3, retry_delay: float = 1.0) -> Subscription:
        """Subscribe to events on a topic."""
        sub_name = name or f"sub-{uuid.uuid4().hex[:8]}"
        sub = Subscription(sub_name, handler, event_types, max_retries, retry_delay)
        self._subscriptions.setdefault(topic, []).append(sub)
        logger.info("Subscription '%s' registered on topic '%s' (types=%s)", sub_name, topic, event_types)
        return sub

    def unsubscribe(self, topic: str, subscription_name: str):
        """Remove a subscription."""
        subs = self._subscriptions.get(topic, [])
        self._subscriptions[topic] = [s for s in subs if s.name != subscription_name]

    async def publish(self, topic: str, event_type: str, payload: dict,
                      metadata: dict | None = None) -> Event:
        """Publish an event and deliver to all matching subscribers."""
        event = Event(
            topic=topic, event_type=event_type,
            payload=payload, metadata=metadata or {},
        )
        self._event_log.append(event)

        subs = self._subscriptions.get(topic, [])
        for sub in subs:
            if not sub.matches(event):
                continue
            await self._deliver_with_retry(sub, event)

        return event

    async def _deliver_with_retry(self, sub: Subscription, event: Event):
        """Deliver event to a subscriber with retry on failure."""
        for attempt in range(sub.max_retries + 1):
            try:
                await sub.handler(event)
                return
            except Exception as e:
                if attempt < sub.max_retries:
                    logger.warning("Subscriber '%s' failed (attempt %d): %s. Retrying...",
                                   sub.name, attempt + 1, e)
                    await asyncio.sleep(sub.retry_delay * (2 ** attempt))
                else:
                    logger.error("Subscriber '%s' failed after %d attempts: %s",
                                 sub.name, sub.max_retries + 1, e)
                    await self._send_to_dlq(event, sub.name, str(e))

    async def _send_to_dlq(self, event: Event, subscription: str, error: str):
        """Send failed event to dead letter queue (Postgres)."""
        try:
            from app.core.database import AsyncSessionLocal
            from app.models.models import AgentFailedEvent
            async with AsyncSessionLocal() as db:
                entry = AgentFailedEvent(
                    id=uuid.uuid4(), event_id=uuid.UUID(event.id),
                    error=error, subscription=subscription, attempts=1,
                )
                db.add(entry)
                await db.commit()
                logger.info("Event %s sent to DLQ (subscription=%s)", event.id, subscription)
        except Exception as e:
            logger.error("Failed to send event to DLQ: %s", e)

    async def persist_event(self, event: Event):
        """Persist event to Postgres event store."""
        try:
            from app.core.database import AsyncSessionLocal
            from app.models.models import AgentEvent
            async with AsyncSessionLocal() as db:
                entry = AgentEvent(
                    id=uuid.UUID(event.id), topic=event.topic,
                    event_type=event.event_type, payload=event.payload,
                    extra=event.metadata, created_at=event.created_at,
                )
                db.add(entry)
                await db.commit()
        except Exception as e:
            logger.error("Failed to persist event: %s", e)

    def get_recent_events(self, topic: str | None = None, limit: int = 50) -> list[Event]:
        """Get recent events from in-memory log."""
        events = self._event_log
        if topic:
            events = [e for e in events if e.topic == topic]
        return events[-limit:]

    def list_subscriptions(self) -> dict[str, list[str]]:
        """List all active subscriptions by topic."""
        return {topic: [s.name for s in subs if not s.paused]
                for topic, subs in self._subscriptions.items()}


# Singleton
event_bus = EventBus()
