"""Competitor Intelligence Agent — analyzes competitors after scans."""
import uuid
import logging
from datetime import datetime, timezone

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.agents.tools import Tool
from app.services.event_bus.broker import EventBus

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CompetitorIntelAgent(BaseAgent):
    """Agent that analyzes competitor data from completed scans.

    Uses the analyze_competitors skill and exposes it as a tool.
    """

    name = "competitor_intel"
    description = "Analyzes competitor presence and positioning from scan results"
    system_prompt = (
        "You are a competitor intelligence analyst. After a scan completes, "
        "you analyze which competitors appeared, their positions, and how "
        "they compare to the brand. You identify gaps and opportunities.\n\n"
        "You have an 'analyze_competitors' skill that handles the analysis. "
        "Use it to analyze scan results."
    )
    model_key = "chatgpt"

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus, allowed_permissions=["db:read", "db:write", "event:emit"])

        # Register the analyze_competitors skill as a tool
        self.tools.register(Tool(
            name="analyze_competitors",
            description="Analyze competitor presence from scan results. Args: brand_id, scan_id",
            handler=self._analyze_skill,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string", "description": "UUID of the brand"},
                    "scan_id": {"type": "string", "description": "UUID of the completed scan"},
                },
                "required": ["brand_id", "scan_id"],
            },
            permissions=["db:read", "db:write", "event:emit"],
        ))

        # Subscribe to scan.completed events
        event_bus.subscribe("scans", self._on_scan_completed, name="competitor_intel_handler",
                           event_types=["scan.completed"])

    async def _analyze_skill(self, brand_id: str, scan_id: str, db=None) -> dict:
        """Execute competitor analysis using the skill."""
        from app.services.skills.analyze_competitors import analyze_competitors
        return await analyze_competitors(brand_id, scan_id, agent_name=self.name, db=db)

    async def _on_scan_completed(self, event):
        """Handle scan.completed events — triggers analysis."""
        scan_id = event.payload.get("scan_id")
        brand_id = event.payload.get("brand_id")
        logger.info("Competitor Intel agent triggered for scan %s (brand %s)", scan_id, brand_id)

        from app.core.database import AsyncSessionLocal
        from sqlalchemy.exc import InterfaceError

        # Try up to 2 times (connection may close during long operations)
        for attempt in range(2):
            try:
                async with AsyncSessionLocal() as db:
                    result = await self.run(
                        AgentContext(brand_id),
                        brand_id=uuid.UUID(brand_id),
                        scan_id=uuid.UUID(scan_id),
                        db=db,
                    )
                    if result.success:
                        await db.commit()
                        logger.info("Competitor Intel analysis complete for brand %s", brand_id)
                    else:
                        logger.warning("Competitor Intel analysis failed: %s", result.error)
                    return
            except InterfaceError as e:
                if attempt == 0:
                    logger.warning("Connection closed, retrying Competitor Intel: %s", e)
                    continue
                logger.exception("Competitor Intel agent error after retry: %s", e)
            except Exception as e:
                logger.exception("Competitor Intel agent error: %s", e)
                return

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Analyze competitor data from a completed scan.

        Primary entry point — uses skill directly for efficiency.
        """
        brand_id = kwargs.get("brand_id")
        scan_id = kwargs.get("scan_id")
        db = kwargs.get("db")

        if not brand_id or not scan_id:
            return AgentResult(False, error="brand_id and scan_id required")

        try:
            from app.services.skills.analyze_competitors import analyze_competitors
            result = await analyze_competitors(
                str(brand_id), str(scan_id), agent_name=self.name, db=db
            )
            return AgentResult(success=True, output=result)
        except Exception as e:
            logger.exception("Competitor Intel analysis failed: %s", e)
            return AgentResult(False, error=str(e))
