import { apiFetch } from "./client";

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

// ─── Blog ──────────────────────────────────────────────────────────────────

export interface BlogCalendarTopic {
  topic: string;
  angle: string;
  keywords: string[];
  category: string;
  target_audience: string;
}

export interface BlogGenerateResult {
  title: string;
  filename: string;
  pr_url: string | null;
  social: Record<string, string>;
}

export interface BlogPost {
  filename: string;
  generated: boolean;
}

export const adminGenerateBlog = () =>
  apiFetch<BlogGenerateResult>("/admin/blog/generate", { method: "POST" });

export const adminListCalendar = () =>
  apiFetch<{ topics: BlogCalendarTopic[] }>("/admin/blog/calendar");

export const adminListBlogPosts = () =>
  apiFetch<{ posts: BlogPost[] }>("/admin/blog/posts");
