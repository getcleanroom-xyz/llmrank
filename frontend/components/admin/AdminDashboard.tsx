"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useAdminCampaigns, useAdminStats, useAdminDeleteCampaign, useAdminCancelCampaign } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

const STATUS_PILL: Record<string, string> = {
  draft: "pill pill-neu",
  scheduled: "pill pill-gold",
  sending: "pill pill-gold",
  sent: "pill pill-pos",
  cancelled: "pill pill-neu",
};

const ACCENT_COLORS = ["var(--primary)", "var(--blue)", "var(--green)", "var(--orange)"];

export function AdminDashboard() {
  const { user } = useAuth();
  const { data: campaigns = [], isLoading, error: loadError, refetch } = useAdminCampaigns();
  const { data: stats } = useAdminStats();
  const deleteCampaign = useAdminDeleteCampaign();
  const cancelCampaign = useAdminCancelCampaign();

  const error = loadError ? (loadError instanceof Error ? loadError.message : "Failed to load") : null;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    try {
      await deleteCampaign.mutateAsync(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelCampaign.mutateAsync(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="page">
      <AppHeader breadcrumb={<span style={{ fontWeight: 600 }}>Admin</span>} />
      <PageHeader>
        <Link href="/admin/campaigns/new" className="btn btn-primary btn-sm">
          + New Campaign
        </Link>
        <button onClick={() => refetch()} className="btn btn-sm">
          Refresh
        </button>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {error && (
          <div className="card" style={{ marginBottom: "var(--gap)", color: "var(--red)", fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Loading...
          </div>
        ) : (
          <>
            {stats && (
              <div className="grid-4" style={{ marginBottom: "var(--gap)" }}>
                {[
                  { label: "Users", value: stats.total_users },
                  { label: "Campaigns", value: stats.total_campaigns },
                  { label: "Sent", value: stats.total_sent },
                  { label: "Opened / Clicked", value: `${stats.total_opened} / ${stats.total_clicked}` },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className="card"
                    style={{
                      textAlign: "center",
                      position: "relative",
                      overflow: "hidden",
                      paddingTop: 20,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: ACCENT_COLORS[i],
                      }}
                    />
                    <div className="section-label" style={{ marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: "2px solid var(--border)",
              background: "var(--bg-dark)",
            }}
          >
            <div className="section-label">Campaigns</div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {campaigns.length} total
            </span>
          </div>

          {campaigns.length === 0 && !isLoading && (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "var(--radius)",
                  border: "2px dashed var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                0
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>No campaigns yet</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 320, lineHeight: 1.6 }}>
                Create your first email campaign to start engaging with your users.
              </div>
              <Link href="/admin/campaigns/new" className="btn btn-primary" style={{ marginTop: 4 }}>
                + Create Campaign
              </Link>
            </div>
          )}

          {campaigns.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1.5px solid var(--bg-dark)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <Link
                  href={`/admin/campaigns/${c.id}`}
                  style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none", fontSize: 14 }}
                >
                  {c.name}
                </Link>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                  {c.subject}
                </div>
              </div>

              <span className={STATUS_PILL[c.status] || "pill pill-neu"} style={{ fontSize: 10 }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>

              <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11, color: "var(--text-secondary)" }}>
                <div style={{ textAlign: "right", minWidth: 60 }}>
                  <div style={{ fontWeight: 600 }}>{c.sent_count} sent</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    <span style={{ color: "var(--green)", fontWeight: 600 }}>{c.opened_count} opened</span>
                    {c.sent_count > 0 && (
                      <div style={{ width: 40, height: 4, background: "var(--bg-dark)", borderRadius: 2, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <div style={{ height: "100%", width: `${Math.round((c.opened_count / c.sent_count) * 100)}%`, background: "var(--green)", borderRadius: 1 }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 4 }}>
                <Link href={`/admin/campaigns/${c.id}`} className="btn btn-sm btn-ghost">
                  Edit
                </Link>
                {(c.status === "scheduled" || c.status === "sending") && (
                  <button onClick={() => handleCancel(c.id)} className="btn btn-sm btn-ghost" style={{ color: "var(--orange)" }}>
                    Cancel
                  </button>
                )}
                {(c.status === "draft" || c.status === "cancelled") && (
                  <button onClick={() => handleDelete(c.id)} className="btn btn-sm btn-ghost" style={{ color: "var(--red)" }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
