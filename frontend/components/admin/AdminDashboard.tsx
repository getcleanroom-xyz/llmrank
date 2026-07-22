"use client";

import { useReducer } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useAdminCampaigns, useAdminStats, useAdminDeleteCampaign, useAdminCancelCampaign, useAdminCloneCampaign, useAdminBlogPosts, useAdminBlogCalendar, useAdminGenerateBlog } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Select } from "@/components/admin/Select";

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

interface State {
  search: string;
  statusFilter: string;
  confirmAction: ConfirmAction;
  blogMessage: string | null;
}

type Action =
  | { type: "setSearch"; value: string }
  | { type: "setStatusFilter"; value: string }
  | { type: "setConfirmAction"; value: ConfirmAction }
  | { type: "setBlogMessage"; value: string | null };

const initialState: State = {
  search: "",
  statusFilter: "",
  confirmAction: null,
  blogMessage: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setSearch":
      return { ...state, search: action.value };
    case "setStatusFilter":
      return { ...state, statusFilter: action.value };
    case "setConfirmAction":
      return { ...state, confirmAction: action.value };
    case "setBlogMessage":
      return { ...state, blogMessage: action.value };
  }
}

export function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: campaigns = [], isLoading, error: loadError, refetch } = useAdminCampaigns();
  const { data: stats } = useAdminStats();
  const deleteCampaign = useAdminDeleteCampaign();
  const cancelCampaign = useAdminCancelCampaign();
  const cloneCampaign = useAdminCloneCampaign();
  const { data: blogPosts } = useAdminBlogPosts();
  const { data: blogCalendar } = useAdminBlogCalendar();
  const generateBlog = useAdminGenerateBlog();

  const [state, dispatch] = useReducer(reducer, initialState);
  const set = (field: keyof State, value: State[keyof State]) =>
    dispatch({ type: `set${field.charAt(0).toUpperCase() + field.slice(1)}` as Action["type"], value } as Action);

  const error = loadError ? (loadError instanceof Error ? loadError.message : "Failed to load") : null;

  const handleDeleteConfirm = async () => {
    if (!state.confirmAction || state.confirmAction.type !== "delete") return;
    try {
      await deleteCampaign.mutateAsync(state.confirmAction.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
    set("confirmAction", null);
  };

  const handleCancelConfirm = async () => {
    if (!state.confirmAction || state.confirmAction.type !== "cancel") return;
    try {
      await cancelCampaign.mutateAsync(state.confirmAction.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    }
    set("confirmAction", null);
  };

  const handleClone = async (id: string) => {
    try {
      const cloned = await cloneCampaign.mutateAsync(id);
      router.push(`/admin/campaigns/${cloned.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Clone failed");
    }
  };

  const filtered = campaigns.filter((c) => {
    if (state.search && !c.name.toLowerCase().includes(state.search.toLowerCase()) && !c.subject.toLowerCase().includes(state.search.toLowerCase())) return false;
    if (state.statusFilter && c.status !== state.statusFilter) return false;
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
        <h1
          style={{
            fontFamily: "var(--font-hand), Caveat, cursive",
            fontSize: "clamp(28px, 4vw, 36px)",
            fontWeight: 700,
            margin: "0 0 2px",
            lineHeight: 1,
            transform: "rotate(-0.4deg)",
          }}
        >
          Admin
        </h1>
        <svg width="100" height="7" viewBox="0 0 100 7" preserveAspectRatio="none" style={{ display: "block", marginBottom: "var(--gap)" }}>
          <path d="M0 4 Q7 1 14 5 Q21 7 28 2 Q35 0 42 5 Q49 7 56 3 Q63 1 70 5 Q77 7 84 2 Q91 0 100 5" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
        </svg>

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
                    className="card sketchy"
                    style={{
                      textAlign: "center",
                      position: "relative",
                      overflow: "hidden",
                      paddingTop: 20,
                      transform: `rotate(${i % 2 === 0 ? "-0.2deg" : "0.2deg"})`,
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

        <div className="card sketchy" style={{ overflow: "hidden", padding: 0 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="section-label">Campaigns</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                value={state.search}
                onChange={(e) => set("search", e.target.value)}
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
              <div style={{ width: 120 }}>
                <Select
                  value={state.statusFilter}
                  onChange={(v) => set("statusFilter", v)}
                  options={[
                    { value: "", label: "All status" },
                    ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
                  ]}
                />
              </div>
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
              <div key={c.id} className="campaign-row">
                <div className="campaign-row-main">
                  <div className="campaign-row-main-name">
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none", fontSize: 14 }}
                    >
                      {c.name}
                    </Link>
                    {c.last_sent_at && (
                      <span className="campaign-row-date" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(c.last_sent_at).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`${STATUS_PILL[c.status] || "pill pill-neu"} campaign-row-pill`} style={{ fontSize: 10 }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </div>
                  <div className="campaign-row-sub">
                    <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                      {c.subject}
                    </span>
                    <div className="campaign-row-end">
                      <div className="campaign-row-stats">
                        <span style={{ fontWeight: 600 }}>{c.sent_count} sent</span>
                        {c.sent_count > 0 && (
                          <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>
                            {openRate}% opened
                            {c.opened_count > 0 && <> · {clickRate}% clicked</>}
                          </span>
                        )}
                      </div>
                      {c.sent_count > 0 && (
                        <div className="campaign-row-bars">
                          <div style={{ height: 4, background: "var(--bg-dark)", borderRadius: 2, overflow: "hidden", border: "1px solid var(--border)" }}>
                            <div style={{ height: "100%", width: `${openRate}%`, background: "var(--green)", borderRadius: 1 }} />
                          </div>
                          <div style={{ height: 4, background: "var(--bg-dark)", borderRadius: 2, overflow: "hidden", border: "1px solid var(--border)" }}>
                            <div style={{ height: "100%", width: `${clickRate}%`, background: "var(--text-secondary)", borderRadius: 1 }} />
                          </div>
                        </div>
                      )}
                      <div className="campaign-row-actions">
                        <Link href={`/admin/campaigns/${c.id}`} className="btn btn-sm btn-ghost">
                          Edit
                        </Link>
                        <button onClick={() => handleClone(c.id)} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>
                          Clone
                        </button>
                        {(c.status === "scheduled" || c.status === "sending") && (
                          <button
                            onClick={() => set("confirmAction", { type: "cancel", id: c.id, name: c.name })}
                            className="btn btn-sm btn-ghost"
                            style={{ color: "var(--orange)" }}
                          >
                            Cancel
                          </button>
                        )}
                        {(c.status === "draft" || c.status === "cancelled") && (
                          <button
                            onClick={() => set("confirmAction", { type: "delete", id: c.id, name: c.name })}
                            className="btn btn-sm btn-ghost"
                            style={{ color: "var(--red)" }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Blog Management Section */}
        <div className="card sketchy" style={{ overflow: "hidden", padding: 0, marginTop: "var(--gap)" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "2px solid var(--border)",
            background: "var(--bg-dark)", gap: 8, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="section-label">Blog</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <button
              onClick={async () => {
                set("blogMessage", null);
                try {
                  const result = await generateBlog.mutateAsync();
                  set("blogMessage", `Generated "${result.title}"${result.pr_url ? ` — PR: ${result.pr_url}` : " (saved locally)"}`);
                } catch (err) {
                  set("blogMessage", err instanceof Error ? err.message : "Generation failed");
                }
              }}
              disabled={generateBlog.isPending}
              className="btn btn-primary btn-sm"
            >
              {generateBlog.isPending ? "Generating..." : "+ Generate Post"}
            </button>
          </div>

          {state.blogMessage && (
            <div style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, background: state.blogMessage.includes("failed") || state.blogMessage.includes("Error") ? "#FEE2E2" : "#E6F9ED", borderBottom: "1px solid var(--border)" }}>
              {state.blogMessage}
            </div>
          )}

          {/* Content Calendar */}
          {blogCalendar && blogCalendar.topics.length > 0 && (
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
                Content Calendar ({blogCalendar.topics.length} topics remaining)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {blogCalendar.topics.slice(0, 5).map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span className="pill pill-neu" style={{ fontSize: 9, flexShrink: 0 }}>{t.category}</span>
                    <span style={{ fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{t.target_audience}</span>
                  </div>
                ))}
                {blogCalendar.topics.length > 5 && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>+{blogCalendar.topics.length - 5} more</div>
                )}
              </div>
            </div>
          )}

          {/* Generated Posts */}
          {blogPosts && blogPosts.posts.length > 0 && (
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
                Posts ({blogPosts.posts.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {blogPosts.posts.map((p) => (
                  <div key={p.filename} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    {p.generated && <span className="pill" style={{ fontSize: 9, background: "#DBEAFF", border: "1px solid var(--blue)" }}>AI</span>}
                    <span style={{ fontWeight: 500 }}>{p.filename.replace(/\.md$/, "").replace(/-/g, " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {blogPosts && blogPosts.posts.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 16px", fontSize: 12, color: "var(--text-muted)" }}>
              No posts yet. Click &quot;Generate Post&quot; to create one.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={state.confirmAction?.type === "delete"}
        title="Delete Campaign"
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => set("confirmAction", null)}
        loading={deleteCampaign.isPending}
      >
        <p>
          Are you sure you want to delete <strong>{state.confirmAction?.name}</strong>?
        </p>
        <p style={{ marginTop: 8, color: "var(--red)", fontWeight: 600 }}>
          This action cannot be undone.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={state.confirmAction?.type === "cancel"}
        title="Cancel Campaign"
        confirmLabel="Cancel Campaign"
        destructive
        onConfirm={handleCancelConfirm}
        onCancel={() => set("confirmAction", null)}
        loading={cancelCampaign.isPending}
      >
        <p>
          Are you sure you want to cancel <strong>{state.confirmAction?.name}</strong>?
        </p>
        <p style={{ marginTop: 8 }}>
          Scheduled sends will be stopped and the campaign will be marked as cancelled.
        </p>
      </ConfirmDialog>
    </div>
  );
}
