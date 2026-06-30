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

export const createCheckout = (packageKey: string, currency: string = "USD") =>
  apiFetch<CheckoutSession>("/payments/checkout", {
    method: "POST",
    body: JSON.stringify({ package_key: packageKey, currency }),
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

export interface AdminCampaignDetail extends AdminCampaign {
  html_body: string;
  from_email: string;
  audience_config: Record<string, unknown> | null;
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
