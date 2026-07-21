import type { Scan, DashboardData, QueryDrilldown } from "@/types";
import { apiFetch } from "./client";

export interface ScanDetailResult {
  llm_name: string;
  mentioned: boolean;
  position: number | null;
  sentiment: string;
  score: number | null;
  competitors_mentioned: { name: string; position: number }[];
}

export interface ScanDetailQuerySummary {
  query_id: string;
  query_text: string;
  results: ScanDetailResult[];
}

export interface ScanDetail {
  id: string;
  brand_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  visibility_score: number | null;
  mention_rate: number | null;
  query_summaries: ScanDetailQuerySummary[];
}

export const triggerScan = (brandId: string, llms: string[]) =>
  apiFetch<Scan>(`/brands/${brandId}/scans`, {
    method: "POST",
    body: JSON.stringify({ llms }),
  });

export const rescanQuery = (brandId: string, queryId: string) =>
  apiFetch<{ scan_id: string }>(`/brands/${brandId}/queries/${queryId}/rescan`, { method: "POST" });

export const getScans = (brandId: string, page: number = 1, perPage: number = 20) =>
  apiFetch<Scan[]>(`/brands/${brandId}/scans?page=${page}&per_page=${perPage}`);

export const getScanResults = (brandId: string, scanId: string) =>
  apiFetch<ScanDetail>(`/brands/${brandId}/scans/${scanId}/results`);

export const getDashboard = (brandId: string) =>
  apiFetch<DashboardData>(`/brands/${brandId}/dashboard`);

export const getQueryDrilldown = (brandId: string, queryId: string) =>
  apiFetch<QueryDrilldown>(`/brands/${brandId}/queries/${queryId}/drilldown`);

export interface LLMQueryResultItem {
  query_id: string;
  query_text: string;
  mentioned: boolean;
  position: number | null;
  sentiment: string;
  score: number | null;
  competitors_mentioned: { name: string; position: number }[];
}

export interface LLMDrilldownData {
  llm_name: string;
  scanned_at: string;
  total_queries: number;
  times_mentioned: number;
  visibility_pct: number;
  avg_position: number | null;
  avg_score: number;
  queries: LLMQueryResultItem[];
}

export const getLLMDrilldown = (brandId: string, llmName: string) =>
  apiFetch<LLMDrilldownData>(`/brands/${brandId}/llms/${encodeURIComponent(llmName)}`);

export interface CompetitorQueryResultItem {
  query_id: string;
  query_text: string;
  llm_name: string;
  competitor_position: number | null;
  brand_mentioned: boolean;
  brand_position: number | null;
  score: number | null;
  sentiment: string;
  raw_response: string;
}

export interface CompetitorLLMBreakdownItem {
  llm_name: string;
  mention_count: number;
  total: number;
  mention_pct: number;
  avg_competitor_position: number | null;
  avg_brand_position: number | null;
  brand_wins: number;
  competitor_wins: number;
}

export interface CompetitorDrilldownData {
  competitor_name: string;
  domain: string;
  logo_url: string;
  insight: string;
  scanned_at: string;
  mention_pct: number;
  total_appearances: number;
  total_queries: number;
  beats_brand_count: number;
  brand_wins_count: number;
  brand_mention_pct: number;
  both_absent_count: number;
  avg_competitor_position: number | null;
  avg_brand_position: number | null;
  sentiment_summary: Record<string, number>;
  llm_breakdown: CompetitorLLMBreakdownItem[];
  competitor_profile: string;
  historical_trend: { date: string; mention_pct: number; brand_mention_pct: number; appearances: number; brand_appearances: number; total_queries: number; per_llm: Record<string, { mention_pct: number; brand_pct: number }> }[];
  queries: CompetitorQueryResultItem[];
}

export const getCompetitorDrilldown = (brandId: string, competitorName: string) =>
  apiFetch<CompetitorDrilldownData>(`/brands/${brandId}/competitors/${encodeURIComponent(competitorName)}`);
