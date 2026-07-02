from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.models import ScanStatus, Sentiment


# Brand schemas
class BrandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    domain: str = Field(..., min_length=1, max_length=200)


class BrandOut(BaseModel):
    id: UUID
    name: str
    domain: str
    owner_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# Query schemas
class QueryCreate(BaseModel):
    query_text: str = Field(..., min_length=3, max_length=500)


class QueryOut(BaseModel):
    id: UUID
    brand_id: UUID
    query_text: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class QuerySuggestRequest(BaseModel):
    brand_name: str
    domain: str
    keywords: list[str] = Field(default_factory=list)


class QuerySuggestResponse(BaseModel):
    suggested_queries: list[str]


class QueryTableItem(BaseModel):
    id: UUID
    query_text: str
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


class DrilldownInsight(BaseModel):
    type: str  # "tip" | "warning"
    text: str


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
