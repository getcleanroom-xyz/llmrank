"use client";

import { useState, useEffect } from "react";
import { useScans } from "@/lib/hooks";
import { getScanResults } from "@/lib/api";
import type { ScanDetail, ScanDetailQuerySummary } from "@/lib/api";

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PositionBadge({ mentioned, position }: { mentioned: boolean; position: number | null }) {
  if (!mentioned) return <span className="pill pill-neg" style={{ fontSize: 9 }}>—</span>;
  if (position === null || position === undefined) return <span className="pill pill-neu" style={{ fontSize: 9 }}>?</span>;
  const cls = position <= 2 ? "pill pill-pos" : position <= 4 ? "pill pill-neu" : "pill pill-neg";
  return <span className={cls} style={{ fontSize: 9 }}>#{position}</span>;
}

function ExpandedScan({ scanId, brandId }: { scanId: string; brandId: string }) {
  const [data, setData] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getScanResults(brandId, scanId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [brandId, scanId]);

  if (loading) return <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-muted)" }}>Loading results...</div>;
  if (error) return <div style={{ padding: "8px 0", fontSize: 11, color: "var(--red)" }}>{error}</div>;
  if (!data || data.query_summaries.length === 0) return <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-muted)" }}>No query results</div>;

  return (
    <div style={{ marginTop: 10, borderTop: "1.5px solid var(--border)", paddingTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={{ textAlign: "center", padding: "6px 0" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Visibility</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{data.visibility_score ?? "—"}</div>
        </div>
        <div style={{ textAlign: "center", padding: "6px 0" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Mention Rate</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{data.mention_rate ?? "—"}%</div>
        </div>
        <div style={{ textAlign: "center", padding: "6px 0" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Queries</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{data.query_summaries.length}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.query_summaries.map((q) => {
          const isOpen = expandedQuery === q.query_id;
          return (
            <div key={q.query_id}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpandedQuery(isOpen ? null : q.query_id); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: isOpen ? "var(--bg-dark)" : "transparent",
                  border: "1px solid transparent",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "var(--bg-dark)"; }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</span>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0, marginLeft: 8 }}>
                  {q.results.map((r) => (
                    <PositionBadge key={r.llm_name} mentioned={r.mentioned} position={r.position} />
                  ))}
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "4px 8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {q.results.map((r) => (
                    <div key={r.llm_name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "2px 0" }}>
                      <span style={{ textTransform: "capitalize", fontWeight: 600, minWidth: 60, color: "var(--text-secondary)" }}>{r.llm_name}</span>
                      <PositionBadge mentioned={r.mentioned} position={r.position} />
                      <span style={{ color: r.sentiment === "positive" ? "#166534" : r.sentiment === "negative" ? "#991B1B" : "var(--text-muted)", fontSize: 10 }}>{r.sentiment}</span>
                      {r.score != null && r.score > 0 && (
                        <span style={{ fontWeight: 700, color: r.score >= 70 ? "#166534" : r.score >= 40 ? "var(--text)" : "#991B1B" }}>{r.score}</span>
                      )}
                      {r.competitors_mentioned.length > 0 && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {r.competitors_mentioned.map((c) => c.name).join(", ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScanHistory({ brandId }: { brandId: string }) {
  const { data: scans = [], isLoading } = useScans(brandId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", fontWeight: 600 }}>Loading scans...</div>;
  if (!scans.length) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", fontWeight: 600 }}>No scans yet.</div>;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {scans.map((scan) => {
          const isExpanded = expandedId === scan.id;
          return (
            <div
              key={scan.id}
              className="card"
              style={{
                padding: 0,
                borderColor: isExpanded ? "var(--primary)" : undefined,
                transition: "border-color 0.1s",
              }}
            >
              <div
                onClick={() => setExpandedId(isExpanded ? null : scan.id)}
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className={`pill ${scan.status === "completed" ? "pill-pos" : scan.status === "failed" ? "pill-neg" : scan.status === "running" ? "pill-gold" : "pill-neu"}`}>
                      {scan.status}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                      {timeAgo(scan.started_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                    {scan.completed_at
                      ? `Completed ${new Date(scan.completed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                      : scan.status === "running"
                      ? "In progress..."
                      : `Started ${new Date(scan.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                </div>
                {scan.status === "completed" && (
                  <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: scan.visibility_score != null && scan.visibility_score >= 70 ? "#166534" : scan.visibility_score != null && scan.visibility_score >= 40 ? "var(--text)" : "#991B1B" }}>
                        {scan.visibility_score ?? "-"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>visibility</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>
                        {scan.mention_rate != null ? `${scan.mention_rate}%` : "-"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>mentions</div>
                    </div>
                  </div>
                )}
                {scan.status === "completed" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>
              {isExpanded && scan.status === "completed" && (
                <div style={{ padding: "0 14px 14px" }}>
                  <ExpandedScan scanId={scan.id} brandId={brandId} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
