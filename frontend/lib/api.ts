import type {
  Brand,
  MonitoredQuery,
  Scan,
  DashboardData,
  QueryDrilldown,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

async function apiFetch<T>(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Brands ────────────────────────────────────────────────────────────────────

export const getBrands = () => apiFetch<Brand[]>("/brands");

export const getBrand = (id: string) => apiFetch<Brand>(`/brands/${id}`);

export const createBrand = (name: string, domain: string) =>
  apiFetch<Brand>("/brands", {
    method: "POST",
    body: JSON.stringify({ name, domain }),
  });

export const deleteBrand = (id: string) =>
  apiFetch<void>(`/brands/${id}`, { method: "DELETE" });

// ─── Queries ───────────────────────────────────────────────────────────────────

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

// ─── Scans ─────────────────────────────────────────────────────────────────────

export const triggerScan = (brandId: string, llms: string[]) =>
  apiFetch<Scan>(`/brands/${brandId}/scans`, {
    method: "POST",
    body: JSON.stringify({ llms }),
  });

export const getScans = (brandId: string) =>
  apiFetch<Scan[]>(`/brands/${brandId}/scans`);

export const getScan = (brandId: string, scanId: string) =>
  apiFetch<Scan>(`/brands/${brandId}/scans/${scanId}`);

// ─── Dashboard & Drilldown ─────────────────────────────────────────────────────

export const getDashboard = (brandId: string) =>
  apiFetch<DashboardData>(`/brands/${brandId}/dashboard`);

export const getQueryDrilldown = (brandId: string, queryId: string) =>
  apiFetch<QueryDrilldown>(`/brands/${brandId}/queries/${queryId}/drilldown`);

// ─── Credits ───────────────────────────────────────────────────────────────────

export interface CreditBalance {
  balance: number;
  total_purchased: number;
  total_used: number;
  cost_per_scan: Record<string, number>;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  balance_after: number;
  created_at: string;
}

export const getCredits = () => apiFetch<CreditBalance>("/credits");

export const getCreditHistory = () => apiFetch<CreditTransaction[]>("/credits/history");
