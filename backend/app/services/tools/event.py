"""Event tools — event bus operations for agents."""
import logging

logger = logging.getLogger(__name__)

# Valid event topics and types per agent
ALLOWED_EVENTS = {
    "scan_orchestrator": {
        "topics": ["scans"],
        "types": ["scan.completed", "scan.failed", "scan.progress"],
    },
    "competitor_intel": {
        "topics": ["competitors"],
        "types": ["competitors.updated", "competitors.analyzed"],
    },
    "query_gen": {
        "topics": ["queries"],
        "types": ["queries.generated", "queries.pruned", "queries.refreshed"],
    },
    "recommendations": {
        "topics": ["chat"],
        "types": ["chat.messages_created", "chat.title_generated"],
    },
    # Wildcard for backward compat
    "_all": {
        "topics": None,  # any topic
        "types": None,   # any type
    },
}


def _validate_event(agent_name: str, topic: str, event_type: str) -> bool:
    """Validate that an agent is allowed to emit this event."""
    perms = ALLOWED_EVENTS.get(agent_name)
    if perms is None:
        # Unknown agent — deny by default (no wildcard bypass)
        logger.warning("Agent '%s' not in allowlist, denying event '%s' on '%s'", agent_name, event_type, topic)
        return False
    if perms["topics"] and topic not in perms["topics"]:
        logger.warning("Agent '%s' not allowed to emit on topic '%s'", agent_name, topic)
        return False
    if perms["types"] and event_type not in perms["types"]:
        logger.warning("Agent '%s' not allowed to emit event type '%s'", agent_name, event_type)
        return False
    return True


async def emit_event(topic: str, event_type: str, payload: dict,
                     agent_name: str = "_all") -> str:
    """Publish an event to the event bus.

    Security:
    - Agent validated against allowed topics/types
    """
    from app.services.event_bus.broker import event_bus

    if not _validate_event(agent_name, topic, event_type):
        raise ValueError(f"Agent '{agent_name}' cannot emit '{event_type}' on topic '{topic}'")

    event = await event_bus.publish(topic, event_type, payload)
    logger.info("Event emitted: %s/%s (agent=%s)", topic, event_type, agent_name)
    return event.id


async def persist_event(event_id: str) -> bool:
    """Persist an event to the database."""
    from app.services.event_bus.broker import event_bus

    # Find the event in memory
    for event in event_bus.get_recent_events(limit=100):
        if event.id == event_id:
            await event_bus.persist_event(event)
            return True
    return False
