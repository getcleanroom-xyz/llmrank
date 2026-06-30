"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useAdminCampaigns, useAdminStats, useAdminDeleteCampaign, useAdminCancelCampaign, useAdminCloneCampaign } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

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

type ConfirmAction =
  | { type: "delete"; id: string; name: string }
  | { type: "cancel"; id: string; name: string }
  | null;

export function AdminDashboard() {
  const { user } = useAuth();
  const { data: campaigns = [], isLoading, error: loadError, refetch } = useAdminCampaigns();
  const { data: stats } = useAdminStats();
  const deleteCampaign = useAdminDeleteCampaign();
  const cancelCampaign = useAdminCancelCampaign();
  const cloneCampaign = useAdminCloneCampaign();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const error = loadError ? (loadError instanceof Error ? loadError.message : "Failed to load") : null;

  const handleDeleteConfirm = async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    try {
      await deleteCampaign.mutateAsync(confirmAction.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
    setConfirmAction(null);
  };

  const handleCancelConfirm = async () => {
    if (!confirmAction || confirmAction.type !== "cancel") return;
    try {
      await cancelCampaign.mutateAsync(confirmAction.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    }
    setConfirmAction(null);
  };

  const handleClone = async (id: string) => {
    try {
      const cloned = await cloneCampaign.mutateAsync(id);
      window.location.href = `/admin/campaigns/${cloned.id}`;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Clone failed");
    }
  };

  const filtered = campaigns.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.subject.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

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
              padding: "12px 16px",
              borderBottom: "2px solid var(--border)",
              background: "var(--bg-dark)",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div className="section-label">Campaigns</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns..."
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  background: "var(--surface)",
                  width: 160,
                  outline: "none",
                }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  fontSize: 11,
                  padding: "4px 6px",
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  background: "var(--surface)",
                  outline: "none",
                }}
              >
                <option value="">All status</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {filtered.length} / {campaigns.length}
              </span>
            </div>
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

          {filtered.length === 0 && campaigns.length > 0 && (
            <div style={{ textAlign: "center", padding: "32px 24px", fontSize: 13, color: "var(--text-muted)" }}>
              No campaigns match your search or filter.
            </div>
          )}

          {filtered.map((c) => {
            const openRate = c.sent_count > 0 ? Math.round((c.opened_count / c.sent_count) * 100) : 0;
            const clickRate = c.opened_count > 0 ? Math.round((c.clicked_count / c.opened_count) * 100) : 0;

            return (
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none", fontSize: 14 }}
                    >
                      {c.name}
                    </Link>
                    {c.last_sent_at && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(c.last_sent_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                    {c.subject}
                  </div>
                </div>

                <span className={STATUS_PILL[c.status] || "pill pill-neu"} style={{ fontSize: 10 }}>
                  {STATUS_LABELS[c.status] || c.status}
                </span>

                <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11, color: "var(--text-secondary)" }}>
                  <div style={{ textAlign: "right", minWidth: 80 }}>
                    <div style={{ fontWeight: 600 }}>{c.sent_count} sent</div>
                    {c.sent_count > 0 && (
                      <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>
                        {openRate}% opened
                        {c.opened_count > 0 && <> · {clickRate}% clicked</>}
                      </div>
                    )}
                  </div>
                  {c.sent_count > 0 && (
                    <div style={{ width: 50, display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ height: 4, background: "var(--bg-dark)", borderRadius: 2, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <div style={{ height: "100%", width: `${openRate}%`, background: "var(--green)", borderRadius: 1 }} />
                      </div>
                      <div style={{ height: 4, background: "var(--bg-dark)", borderRadius: 2, overflow: "hidden", border: "1px solid var(--border)" }}>
                        <div style={{ height: "100%", width: `${clickRate}%`, background: "var(--blue)", borderRadius: 1 }} />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  <Link href={`/admin/campaigns/${c.id}`} className="btn btn-sm btn-ghost">
                    Edit
                  </Link>
                  <button onClick={() => handleClone(c.id)} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>
                    Clone
                  </button>
                  {(c.status === "scheduled" || c.status === "sending") && (
                    <button
                      onClick={() => setConfirmAction({ type: "cancel", id: c.id, name: c.name })}
                      className="btn btn-sm btn-ghost"
                      style={{ color: "var(--orange)" }}
                    >
                      Cancel
                    </button>
                  )}
                  {(c.status === "draft" || c.status === "cancelled") && (
                    <button
                      onClick={() => setConfirmAction({ type: "delete", id: c.id, name: c.name })}
                      className="btn btn-sm btn-ghost"
                      style={{ color: "var(--red)" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction?.type === "delete"}
        title="Delete Campaign"
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmAction(null)}
        loading={deleteCampaign.isPending}
      >
        <p>
          Are you sure you want to delete <strong>{confirmAction?.name}</strong>?
        </p>
        <p style={{ marginTop: 8, color: "var(--red)", fontWeight: 600 }}>
          This action cannot be undone.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmAction?.type === "cancel"}
        title="Cancel Campaign"
        confirmLabel="Cancel Campaign"
        destructive
        onConfirm={handleCancelConfirm}
        onCancel={() => setConfirmAction(null)}
        loading={cancelCampaign.isPending}
      >
        <p>
          Are you sure you want to cancel <strong>{confirmAction?.name}</strong>?
        </p>
        <p style={{ marginTop: 8 }}>
          Scheduled sends will be stopped and the campaign will be marked as cancelled.
        </p>
      </ConfirmDialog>
    </div>
  );
}
