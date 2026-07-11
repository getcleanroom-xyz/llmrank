import type { MonitoredQuery } from "@/types";
import { apiFetch } from "./client";

export interface QueriesTableItem {
  id: string;
  query_text: string;
  query_type?: string | null;
  query_score?: number | null;
  is_active: boolean;
  created_at: string;
  result_count: number;
  last_scan_at: string | null;
}

export interface QueriesTableResponse {
  items: QueriesTableItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ScoredQuery {
  query_text: string;
  query_type: string;
  score: number;
}

export interface ProbeInsight {
  query_text: string;
  brand_overmentioned: boolean;
  competitors_found: string[];
  recommendation: string;
}

export interface ProbeResult {
  insights: ProbeInsight[];
  summary: string;
}

export interface BrandClassification {
  industry: string;
  sub_category: string;
  price_tier: string;
  target_audience: string;
  key_features: string[];
}

export interface CompetitorInfo {
  name: string;
  domain: string;
  relevance_score: number;
}

export interface QuerySuggestFullResponse {
  classification: BrandClassification;
  competitors: CompetitorInfo[];
  queries: ScoredQuery[];
  probe_result?: ProbeResult;
}

export const getQueries = (brandId: string) =>
  apiFetch<MonitoredQuery[]>(`/brands/${brandId}/queries`);

export const addQuery = (brandId: string, query_text: string) =>
  apiFetch<MonitoredQuery>(`/brands/${brandId}/queries`, {
    method: "POST",
    body: JSON.stringify({ query_text }),
  });

export const deleteQuery = (brandId: string, queryId: string) =>
  apiFetch<void>(`/brands/${brandId}/queries/${queryId}`, { method: "DELETE" });

export const suggestQueries = (brandId: string, brand_name: string, domain: string, keywords: string[]) =>
  apiFetch<{ suggested_queries: string[] }>(`/brands/${brandId}/queries/suggest`, {
    method: "POST",
    body: JSON.stringify({ brand_name, domain, keywords }),
  });

export const getQueriesTable = (brandId: string, page: number = 1, per_page: number = 20, q: string = "") =>
  apiFetch<QueriesTableResponse>(`/brands/${brandId}/queries/table?page=${page}&per_page=${per_page}&q=${encodeURIComponent(q)}`);

export const suggestQueriesFull = (brandId: string, brand_name: string, domain: string, keywords: string[] = []) =>
  apiFetch<QuerySuggestFullResponse>(`/brands/${brandId}/queries/suggest`, {
    method: "POST",
    body: JSON.stringify({ brand_name, domain, keywords }),
  });

export const probeQueries = (brandId: string) =>
  apiFetch<{ queries: ScoredQuery[]; probe_result: ProbeResult }>(`/brands/${brandId}/queries/probe`, {
    method: "POST",
  });

export interface QueryTrendPoint {
  date: string;
  score: number;
  scan_id: string;
}

export const getQueryTrend = (brandId: string, days: number = 30) =>
  apiFetch<Record<string, QueryTrendPoint[]>>(`/brands/${brandId}/queries/trend?days=${days}`);

export const bulkUpdateQueries = (brandId: string, action: "activate" | "deactivate" | "delete", queryIds: string[]) =>
  apiFetch<{ ok: boolean; affected: number; action: string }>(`/brands/${brandId}/queries/bulk`, {
    method: "POST",
    body: JSON.stringify({ action, query_ids: queryIds }),
  });
