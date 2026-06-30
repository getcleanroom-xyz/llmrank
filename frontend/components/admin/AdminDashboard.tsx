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

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--text-muted)",
  scheduled: "var(--blue)",
  sending: "var(--orange)",
  sent: "var(--green)",
  cancelled: "var(--text-muted)",
};

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
                <div className="card" style={{ textAlign: "center" }}>
                  <div className="section-label">Users</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total_users}</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div className="section-label">Campaigns</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total_campaigns}</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div className="section-label">Sent</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total_sent}</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div className="section-label">Opened / Clicked</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {stats.total_opened} / {stats.total_clicked}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label">Campaigns</div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {campaigns.length} total
            </span>
          </div>

          {campaigns.length === 0 && !isLoading && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
              No campaigns yet.
              <br />
              <Link href="/admin/campaigns/new" style={{ color: "var(--blue)", fontWeight: 600 }}>
                Create your first campaign
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
                padding: "10px 0",
                borderBottom: "1px solid var(--bg-dark)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 150 }}>
                <Link
                  href={`/admin/campaigns/${c.id}`}
                  style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none", fontSize: 14 }}
                >
                  {c.name}
                </Link>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {c.subject}
                </div>
              </div>

              <span className="pill" style={{ borderColor: STATUS_COLORS[c.status] || "var(--border)", color: STATUS_COLORS[c.status] || "var(--text)" }}>
                {STATUS_LABELS[c.status] || c.status}
              </span>

              <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "right", minWidth: 80 }}>
                <div>{c.sent_count} sent</div>
                <div>{c.opened_count} opened</div>
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
