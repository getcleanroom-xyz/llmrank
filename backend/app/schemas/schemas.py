from pydantic import BaseModel, Field
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
    query_type: Optional[str] = None
    query_score: Optional[int] = None


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
    brand_name: str
    domain: str
    keywords: list[str] = Field(default_factory=list)


class QuerySuggestResponse(BaseModel):
    suggested_queries: list[str]


class BrandClassification(BaseModel):
    industry: str
    sub_category: str
    price_tier: str
    target_audience: str
    key_features: list[str]


class CompetitorInfo(BaseModel):
    name: str
    domain: str
    relevance_score: int = 3


class ScoredQuery(BaseModel):
    query_text: str
    query_type: str
    score: int


class ProbeInsight(BaseModel):
    query_text: str
    brand_overmentioned: bool
    competitors_found: list[str]
    recommendation: str


class ProbeResult(BaseModel):
    insights: list[ProbeInsight]
    summary: str


class QuerySuggestFullResponse(BaseModel):
    classification: BrandClassification
    competitors: list[CompetitorInfo]
    queries: list[ScoredQuery]
    probe_result: Optional[ProbeResult] = None


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
    llms: list[str] = Field(default=["chatgpt", "llama"])


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
    position: int


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
    competitor_position: int
    brand_mentioned: bool
    brand_position: Optional[int]
    score: Optional[float]

    model_config = {"from_attributes": True}


class CompetitorDrilldownOut(BaseModel):
    competitor_name: str
    scanned_at: datetime
    mention_pct: float
    total_appearances: int
    total_queries: int
    beats_brand_count: int
    queries: list[CompetitorQueryResult]


# Credit schemas
class CreditBalanceOut(BaseModel):
    balance: int
    total_purchased: int
    total_used: int
    cost_per_scan: dict[str, int]


class CreditGrantRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Credits to grant")
    description: str = Field(default="Admin grant")


class CreditTransactionOut(BaseModel):
    id: UUID
    amount: int
    type: str
    description: str
    balance_after: int
    created_at: datetime

    model_config = {"from_attributes": True}
