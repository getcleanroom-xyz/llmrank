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
      credentials: "include",
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

export const getBrands = (page: number = 1, perPage: number = 50, search: string = "") =>
  apiFetch<Brand[]>(`/brands?page=${page}&per_page=${perPage}&search=${encodeURIComponent(search)}`);

export const getBrand = (id: string) => apiFetch<Brand>(`/brands/${id}`);

export const createBrand = (name: string, domain: string, competitors: string[] = []) =>
  apiFetch<Brand>("/brands", {
    method: "POST",
    body: JSON.stringify({ name, domain, competitors }),
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

export const getQueriesTable = (brandId: string, page: number = 1, per_page: number = 20, q: string = "") =>
  apiFetch<QueriesTableResponse>(`/brands/${brandId}/queries/table?page=${page}&per_page=${per_page}&q=${encodeURIComponent(q)}`);

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

export const suggestQueriesFull = (brandId: string, keywords: string[] = []) =>
  apiFetch<QuerySuggestFullResponse>(`/brands/${brandId}/queries/suggest`, {
    method: "POST",
    body: JSON.stringify({ brand_name: "", domain: "", keywords }),
  });

export const probeQueries = (brandId: string) =>
  apiFetch<{ queries: ScoredQuery[]; probe_result: ProbeResult }>(`/brands/${brandId}/queries/probe`, {
    method: "POST",
  });

// ─── Scans ─────────────────────────────────────────────────────────────────────

export const triggerScan = (brandId: string, llms: string[]) =>
  apiFetch<Scan>(`/brands/${brandId}/scans`, {
    method: "POST",
    body: JSON.stringify({ llms }),
  });

export const rescanQuery = (brandId: string, queryId: string) =>
  apiFetch<{ scan_id: string }>(`/brands/${brandId}/queries/${queryId}/rescan`, { method: "POST" });

export const getScans = (brandId: string, page: number = 1, perPage: number = 20) =>
  apiFetch<Scan[]>(`/brands/${brandId}/scans?page=${page}&per_page=${perPage}`);

export const getScan = (brandId: string, scanId: string) =>
  apiFetch<Scan>(`/brands/${brandId}/scans/${scanId}`);

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

export const getScanResults = (brandId: string, scanId: string) =>
  apiFetch<ScanDetail>(`/brands/${brandId}/scans/${scanId}/results`);

// ─── Dashboard & Drilldown ─────────────────────────────────────────────────────

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
}

export interface CompetitorDrilldownData {
  competitor_name: string;
  domain: string;
  insight: string;
  scanned_at: string;
  mention_pct: number;
  total_appearances: number;
  total_queries: number;
  beats_brand_count: number;
  queries: CompetitorQueryResultItem[];
}

export const getCompetitorDrilldown = (brandId: string, competitorName: string) =>
  apiFetch<CompetitorDrilldownData>(`/brands/${brandId}/competitors/${encodeURIComponent(competitorName)}`);

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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  is_admin?: boolean;
}

export interface PasskeyInfo {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string;
}

export const authRegisterStart = (email: string, display_name: string) =>
  apiFetch<{ challenge: string; rp_id: string; user_id: string }>("/auth/register/start", {
    method: "POST",
    body: JSON.stringify({ email, display_name }),
  });

export const authRegisterFinish = (credential: Record<string, unknown>, device_name: string) =>
  apiFetch<{ status: string; user: AuthUser }>("/auth/register/finish", {
    method: "POST",
    body: JSON.stringify({ credential, device_name }),
  });

export const authLoginStart = (email: string) =>
  apiFetch<{ challenge: string; rp_id: string; allow_credentials: string[] }>("/auth/login/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const authLoginFinish = (credential: Record<string, unknown>) =>
  apiFetch<{ status: string; user: AuthUser }>("/auth/login/finish", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });

export const authGetMe = () => apiFetch<AuthUser>("/auth/me");

export const authLogout = () =>
  apiFetch<{ status: string }>("/auth/logout", { method: "POST" });

export const authListPasskeys = () => apiFetch<PasskeyInfo[]>("/auth/passkeys");

export const authDeletePasskey = (passkeyId: string) =>
  apiFetch<{ status: string }>(`/auth/passkeys/${passkeyId}`, { method: "DELETE" });

// ─── Payments ────────────────────────────────────────────────────────────────

export interface CreditPackage {
  key: string;
  credits: number;
  amount_usd: number;
  label: string;
}

export interface CheckoutSession {
  charge_id: string;
  reference: string;
  checkout_url: string | null;
  amount: number;
  currency: string;
}

export const getCreditPackages = () => apiFetch<CreditPackage[]>("/payments/packages");

export const getEncryptionKey = () => apiFetch<{ key: string }>("/payments/encryption-key");

export const createCheckout = (packageKey: string, currency: string = "USD", encryptedCard: Record<string, string>) =>
  apiFetch<CheckoutSession>("/payments/checkout", {
    method: "POST",
    body: JSON.stringify({ package_key: packageKey, currency, encrypted_card: encryptedCard }),
  });

export const verifyPayment = (transactionId: string) =>
  apiFetch<Record<string, unknown>>(`/payments/verify/${transactionId}`);

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminCampaign {
  id: string;
  name: string;
  subject: string;
  audience_type: string;
  status: string;
  schedule_type: string;
  cron_expr: string | null;
  scheduled_at: string | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateVar {
  key: string;
  label: string;
  default_value?: string;
}

export interface AdminCampaignDetail extends AdminCampaign {
  html_body: string;
  from_email: string;
  audience_config: Record<string, unknown> | null;
  template_vars: TemplateVar[] | null;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  total_campaigns: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
}

export const adminListCampaigns = () =>
  apiFetch<AdminCampaign[]>("/admin/campaigns");

export const adminGetCampaign = (id: string) =>
  apiFetch<AdminCampaignDetail>(`/admin/campaigns/${id}`);

export const adminCreateCampaign = (data: {
  name: string;
  subject: string;
  html_body: string;
  from_email?: string;
  audience_type?: string;
  audience_config?: Record<string, unknown>;
  template_vars?: TemplateVar[];
}) =>
  apiFetch<AdminCampaign>("/admin/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const adminUpdateCampaign = (id: string, data: Record<string, unknown>) =>
  apiFetch<AdminCampaign>(`/admin/campaigns/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const adminDeleteCampaign = (id: string) =>
  apiFetch<{ status: string }>(`/admin/campaigns/${id}`, { method: "DELETE" });

export const adminScheduleCampaign = (id: string, data: {
  schedule_type: string;
  cron_expr?: string;
  scheduled_at?: string;
}) =>
  apiFetch<AdminCampaign>(`/admin/campaigns/${id}/schedule`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const adminCancelCampaign = (id: string) =>
  apiFetch<AdminCampaign>(`/admin/campaigns/${id}/cancel`, { method: "POST" });

export const adminPreviewCampaign = (id: string) =>
  apiFetch<{ status: string; message: string }>(`/admin/campaigns/${id}/preview`, { method: "POST" });

export const adminBuildAudience = (id: string) =>
  apiFetch<{ status: string; recipients: number }>(`/admin/campaigns/${id}/build-audience`, { method: "POST" });

export const adminUploadCsv = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<{ status: string; recipients_added: number }>(`/admin/campaigns/${id}/upload-csv`, {
    method: "POST",
    body: form,
  });
};

export const adminListUsers = (search?: string) =>
  apiFetch<AdminUser[]>(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`);

export const adminGetStats = () =>
  apiFetch<AdminStats>("/admin/stats");

export const adminCloneCampaign = (id: string) =>
  apiFetch<AdminCampaignDetail>(`/admin/campaigns/${id}/clone`, { method: "POST" });
