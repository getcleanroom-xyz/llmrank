"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import {
  adminListCampaigns,
  adminGetStats,
  adminDeleteCampaign,
  adminCancelCampaign,
  type AdminCampaign,
  type AdminStats,
} from "@/lib/api";

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
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [c, s] = await Promise.all([
        adminListCampaigns(),
        adminGetStats(),
      ]);
      setCampaigns(c);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    try {
      await adminDeleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const updated = await adminCancelCampaign(id);
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: updated.status } : c));
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
        <button onClick={loadData} className="btn btn-sm">
          Refresh
        </button>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {error && (
          <div className="card" style={{ marginBottom: "var(--gap)", color: "var(--red)", fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {loading ? (
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

          {campaigns.length === 0 && !loading && (
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
