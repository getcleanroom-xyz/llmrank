export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type Sentiment = "positive" | "neutral" | "negative" | "not_mentioned";

export interface Brand {
  id: string;
  name: string;
  domain: string;
  competitors: { name: string; domain: string }[] | null;
  created_at: string;
}

export interface MonitoredQuery {
  id: string;
  brand_id: string;
  query_text: string;
  query_type?: string | null;
  query_score?: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Scan {
  id: string;
  brand_id: string;
  status: ScanStatus;
  started_at: string;
  completed_at: string | null;
  visibility_score: number | null;
  mention_rate: number | null;
}

export interface AnnotationSpan {
  text: string;
  type: "brand" | "competitor" | "qualifier" | "neutral";
  entity?: string | null;
}

export interface CompetitorMention {
  name: string;
  position: number | null;
}

export interface QueryResult {
  id: string;
  scan_id: string;
  query_id: string;
  llm_name: string;
  raw_response: string;
  mentioned: boolean;
  position: number | null;
  sentiment: Sentiment;
  competitors_mentioned: CompetitorMention[];
  annotated_response: AnnotationSpan[] | null;
  score: number | null;
  created_at: string;
}

export interface LLMBreakdown {
  llm_name: string;
  visibility_pct: number;
  avg_position: number | null;
  sentiment_distribution: Record<string, number>;
  score: number;
}

export interface CompetitorShareItem {
  name: string;
  mention_pct: number;
}

export interface QuerySummary {
  query_id: string;
  query_text: string;
  results: {
    llm_name: string;
    mentioned: boolean;
    position: number | null;
    sentiment: Sentiment;
    score: number | null;
  }[];
}

export interface DashboardData {
  brand: Brand;
  latest_scan: Scan | null;
  active_scan: Scan | null;
  visibility_score: number;
  mention_rate: number;
  queries_monitored: number;
  top_competitor: string | null;
  llm_breakdown: LLMBreakdown[];
  competitor_share: CompetitorShareItem[];
  query_summaries: QuerySummary[];
  score_history: { date: string; visibility_score: number; mention_rate: number }[];
  insights: { type: string; text: string }[];
}

export interface DrilldownInsight {
  type: "tip" | "warning";
  text: string;
}

export interface QueryDrilldown {
  query_text: string;
  scanned_at: string;
  avg_position: number | null;
  llms_mentioned: number;
  total_llms: number;
  top_competitor: string | null;
  overall_sentiment: string;
  results: QueryResult[];
  insights: DrilldownInsight[];
}
