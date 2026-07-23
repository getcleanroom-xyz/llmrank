from pydantic import BaseModel, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.models import ScanStatus, Sentiment


# Brand schemas
class BrandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    domain: str = Field(..., min_length=1, max_length=200)
    competitors: list[str] = Field(default_factory=list)


class BrandOut(BaseModel):
    id: UUID
    name: str
    domain: str
    owner_id: Optional[UUID] = None
    competitors: Optional[list] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# Query schemas
class QueryCreate(BaseModel):
    query_text: str = Field(..., min_length=3, max_length=500)
    query_type: Optional[str] = Field(default=None, max_length=20)
    query_score: Optional[int] = Field(default=None, ge=0, le=5)


class QueryOut(BaseModel):
    id: UUID
    brand_id: UUID
    query_text: str
    query_type: Optional[str] = None
    query_score: Optional[int] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class QuerySuggestRequest(BaseModel):
    brand_name: str = Field(..., min_length=1, max_length=200)
    domain: str = Field(..., min_length=1, max_length=200)
    keywords: list[str] = Field(default_factory=list)


class QuerySuggestResponse(BaseModel):
    suggested_queries: list[str]


class QueryTableItem(BaseModel):
    id: UUID
    query_text: str
    query_type: Optional[str] = None
    query_score: Optional[int] = None
    is_active: bool
    created_at: datetime
    result_count: int = 0
    last_scan_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class QueryTableResponse(BaseModel):
    items: list[QueryTableItem]
    total: int
    page: int
    per_page: int
    pages: int


# Scan schemas
class ScanCreate(BaseModel):
    llms: list[str] = Field(default_factory=lambda: ["chatgpt", "llama"], min_length=1)

    @field_validator("llms")
    @classmethod
    def validate_llm_names(cls, v: list[str]) -> list[str]:
        from app.services.credit_service import CREDIT_COSTS
        valid = set(CREDIT_COSTS.keys())
        invalid = [llm for llm in v if llm not in valid]
        if invalid:
            raise ValueError(f"Invalid LLM names: {invalid}. Valid options: {sorted(valid)}")
        return v


class ScanOut(BaseModel):
    id: UUID
    brand_id: UUID
    status: ScanStatus
    started_at: datetime
    completed_at: Optional[datetime]
    visibility_score: Optional[float]
    mention_rate: Optional[float]

    model_config = {"from_attributes": True}


# Result schemas
class CompetitorMention(BaseModel):
    name: str
    position: Optional[int] = None


class AnnotationSpan(BaseModel):
    text: str
    type: str  # "brand", "competitor", "qualifier", "neutral"
    entity: Optional[str] = None


class QueryResultOut(BaseModel):
    id: UUID
    scan_id: UUID
    query_id: UUID
    llm_name: str
    raw_response: str
    mentioned: bool
    position: Optional[int]
    sentiment: Sentiment
    competitors_mentioned: list[CompetitorMention]
    annotated_response: Optional[list[AnnotationSpan]]
    score: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


# Dashboard aggregated schemas
class LLMBreakdown(BaseModel):
    llm_name: str
    visibility_pct: float
    avg_position: Optional[float]
    sentiment_distribution: dict[str, int]
    score: float


class CompetitorShareItem(BaseModel):
    name: str
    mention_pct: float
    beats_you: int = 0
    threat_level: str = "none"  # "high", "medium", "low", "none"
    logo_url: str = ""


class QuerySummary(BaseModel):
    query_id: UUID
    query_text: str
    results: list[dict]


class DrilldownInsight(BaseModel):
    type: str  # "tip" | "warning"
    text: str


class DashboardOut(BaseModel):
    brand: BrandOut
    latest_scan: Optional[ScanOut]
    active_scan: Optional[ScanOut]
    visibility_score: float
    mention_rate: float
    queries_monitored: int
    top_competitor: Optional[str]
    llm_breakdown: list[LLMBreakdown]
    competitor_share: list[CompetitorShareItem]
    query_summaries: list[QuerySummary]
    score_history: list[dict]
    insights: list[DrilldownInsight] = Field(default_factory=list)


class QueryDrilldownOut(BaseModel):
    query_text: str
    scanned_at: datetime
    avg_position: Optional[float]
    llms_mentioned: int
    total_llms: int
    top_competitor: Optional[str]
    overall_sentiment: str
    results: list[QueryResultOut]
    insights: list[DrilldownInsight]


# LLM drilldown
class LLMQueryResultItem(BaseModel):
    query_id: UUID
    query_text: str
    mentioned: bool
    position: Optional[int]
    sentiment: str
    score: Optional[float]
    competitors_mentioned: list[CompetitorMention]

    model_config = {"from_attributes": True}


class LLMDrilldownOut(BaseModel):
    llm_name: str
    scanned_at: datetime
    total_queries: int
    times_mentioned: int
    visibility_pct: float
    avg_position: Optional[float]
    avg_score: float
    queries: list[LLMQueryResultItem]


# Competitor drilldown
class CompetitorQueryResult(BaseModel):
    query_id: UUID
    query_text: str
    llm_name: str
    competitor_position: Optional[int]
    brand_mentioned: bool
    brand_position: Optional[int]
    score: Optional[float]
    sentiment: str = "neutral"
    raw_response: str = ""

    model_config = {"from_attributes": True}


class CompetitorLLMBreakdown(BaseModel):
    llm_name: str
    mention_count: int
    total: int
    mention_pct: float
    avg_competitor_position: Optional[float]
    avg_brand_position: Optional[float]
    brand_wins: int
    competitor_wins: int


class CompetitorHistoricalPoint(BaseModel):
    date: str
    mention_pct: float
    brand_mention_pct: float
    appearances: int
    brand_appearances: int
    total_queries: int
    per_llm: dict = Field(default_factory=dict)  # {"chatgpt": {"mention_pct": 50, "brand_pct": 30}, ...}


class CompetitorDrilldownOut(BaseModel):
    competitor_name: str
    domain: str = ""
    logo_url: str = ""
    insight: str = ""
    scanned_at: datetime
    mention_pct: float
    total_appearances: int
    total_queries: int
    beats_brand_count: int
    brand_wins_count: int = 0
    brand_mention_pct: float = 0
    brand_avg_position: Optional[float] = None
    both_absent_count: int = 0
    avg_competitor_position: Optional[float] = None
    avg_brand_position: Optional[float] = None
    sentiment_summary: dict = Field(default_factory=dict)
    llm_breakdown: list[CompetitorLLMBreakdown] = Field(default_factory=list)
    competitor_profile: str = ""
    historical_trend: list[CompetitorHistoricalPoint] = Field(default_factory=list)
    queries: list[CompetitorQueryResult]


# Credit schemas
class CreditBalanceOut(BaseModel):
    balance: int
    total_purchased: int
    total_used: int
    cost_per_scan: dict[str, int]


class CreditGrantRequest(BaseModel):
    amount: int = Field(..., gt=0, le=1000000, description="Credits to grant (max 1M)")
    description: str = Field(default="Admin grant")
    target_user_id: UUID | None = Field(default=None, description="User to grant credits to (admin only)")


class CreditTransactionOut(BaseModel):
    id: UUID
    amount: int
    type: str
    description: str
    balance_after: int
    created_at: datetime

    model_config = {"from_attributes": True}


# Recommendation schemas
class RecommendationRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[dict] | None = Field(default=None, description="Chat history [{role, content}]")
    conversation_id: str | None = Field(default=None, description="Conversation ID to persist messages to")


# Conversation schemas
class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ConversationOut(BaseModel):
    id: UUID
    brand_id: UUID
    user_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=50000)


class ChatMessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationListResponse(BaseModel):
    items: list[ConversationOut]
    total: int
    page: int
    per_page: int
