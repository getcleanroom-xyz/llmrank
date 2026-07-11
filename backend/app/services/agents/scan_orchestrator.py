"""Scan Orchestrator Agent — manages the scan lifecycle using skills."""
import uuid
import asyncio
import logging
from datetime import datetime, timezone

from app.services.agents.base import BaseAgent, AgentContext, AgentResult
from app.services.agents.tools import Tool
from app.services.event_bus.broker import EventBus

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ScanOrchestratorAgent(BaseAgent):
    """Agent that orchestrates LLM scans for a brand.

    Uses the run_scan skill to execute scans, and exposes
    the skill as a tool in the ReAct loop.
    """

    name = "scan_orchestrator"
    description = "Runs visibility scans across multiple LLMs for a brand"
    system_prompt = (
        "You are a scan orchestrator. Your job is to run visibility scans "
        "across multiple LLMs and report results. You manage the scan lifecycle "
        "from creation to completion, ensuring all queries are executed and "
        "results are properly scored and stored.\n\n"
        "You have a 'run_scan' skill that handles the full scan lifecycle. "
        "Use it to execute scans for brands."
    )
    model_key = "chatgpt"

    def __init__(self, event_bus: EventBus):
        super().__init__(event_bus, allowed_permissions=["db:read", "db:write", "llm:call", "event:emit"])

        # Register the run_scan skill as a tool
        self.tools.register(Tool(
            name="run_scan",
            description="Execute a full visibility scan for a brand. Args: brand_id, scan_id, llm_names",
            handler=self._run_scan_skill,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string", "description": "UUID of the brand to scan"},
                    "scan_id": {"type": "string", "description": "UUID of the scan record to update"},
                    "llm_names": {"type": "array", "items": {"type": "string"}, "description": "LLM models to scan with"},
                },
                "required": ["brand_id", "scan_id", "llm_names"],
            },
            permissions=["db:read", "db:write", "llm:call", "event:emit"],
        ))

        # Register read-only tools for context gathering
        self.tools.register(Tool(
            name="get_brand_info",
            description="Get brand information. Args: brand_id",
            handler=self._get_brand_info,
            parameters={
                "type": "object",
                "properties": {
                    "brand_id": {"type": "string"},
                },
                "required": ["brand_id"],
            },
            permissions=["db:read"],
        ))

    async def _run_scan_skill(self, brand_id: str, scan_id: str, llm_names: list[str]) -> dict:
        """Execute a scan using the run_scan skill."""
        from app.services.skills.run_scan import run_scan
        return await run_scan(brand_id, scan_id, llm_names, agent_name=self.name)

    async def _get_brand_info(self, brand_id: str) -> dict:
        """Get brand info from database."""
        from app.services.tools.db import read_model
        results = await read_model("Brand", {"id": uuid.UUID(brand_id)})
        return results[0] if results else {}

    async def run(self, context: AgentContext, **kwargs) -> AgentResult:
        """Execute a scan. Expects brand_id, db, llm_names in kwargs.

        This is the primary entry point called by the API.
        Uses the skill directly for efficiency (no ReAct loop needed for known tasks).
        """
        brand_id = kwargs.get("brand_id")
        db = kwargs.get("db")
        llm_names = kwargs.get("llm_names", ["chatgpt", "llama"])
        scan_id = kwargs.get("scan_id")

        if not brand_id or not db:
            return AgentResult(False, error="brand_id and db required")

        try:
            from app.services.skills.run_scan import run_scan
            result = await run_scan(
                str(brand_id), str(scan_id), llm_names, agent_name=self.name
            )
            return AgentResult(
                success=True,
                output=result,
                metadata={"brand_id": str(brand_id), "llm_count": len(llm_names)},
            )
        except Exception as e:
            logger.exception("Scan agent failed for brand %s", brand_id)
            return AgentResult(False, error=str(e))
