"""Agent registry — initializes and connects all agents via the event bus."""
import logging
from app.services.event_bus.broker import EventBus, event_bus
from app.services.agents.scan_orchestrator import ScanOrchestratorAgent
from app.services.agents.competitor_intel import CompetitorIntelAgent
from app.services.agents.query_gen import QueryGenAgent
from app.services.agents.recommendations import RecommendationsAgent

logger = logging.getLogger(__name__)


class AgentRegistry:
    """Manages all agents and their event subscriptions."""

    def __init__(self, bus: EventBus | None = None):
        self.bus = bus or event_bus
        self.scan_orchestrator = ScanOrchestratorAgent(self.bus)
        self.competitor_intel = CompetitorIntelAgent(self.bus)
        self.query_gen = QueryGenAgent(self.bus)
        self.recommendations = RecommendationsAgent(self.bus)
        logger.info("Agent registry initialized: %d agents, subscriptions: %s",
                     4, self.bus.list_subscriptions())


# Singleton
agent_registry = AgentRegistry()
