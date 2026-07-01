"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getScanResults } from "@/lib/api";
import type { ScanDetail, ScanDetailQuerySummary, ScanDetailResult } from "@/lib/api";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { ScoreRing } from "@/components/ui";

function PositionBadge({ mentioned, position }: { mentioned: boolean; position: number | null }) {
  if (!mentioned) return <span className="pill pill-neg" style={{ fontSize: 10 }}>—</span>;
  if (position === null || position === undefined) return <span className="pill pill-neu" style={{ fontSize: 10 }}>?</span>;
  const cls = position <= 2 ? "pill pill-pos" : position <= 4 ? "pill pill-neu" : "pill pill-neg";
  return <span className={cls} style={{ fontSize: 10 }}>#{position}</span>;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    positive: { label: "Positive", cls: "pill pill-pos" },
    neutral: { label: "Neutral", cls: "pill pill-neu" },
    negative: { label: "Negative", cls: "pill pill-neg" },
    not_mentioned: { label: "N/A", cls: "pill pill-neu" },
  };
  const { label, cls } = map[sentiment] ?? { label: sentiment, cls: "pill pill-neu" };
  return <span className={cls} style={{ fontSize: 9 }}>{label}</span>;
}

function QueryResultCard({ summary }: { summary: ScanDetailQuerySummary }) {
  const [expanded, setExpanded] = useState(false);
  const mentioned = summary.results.filter((r) => r.mentioned);
  const notMentioned = summary.results.filter((r) => !r.mentioned);

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{summary.query_text}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {mentioned.length} mentioned · {notMentioned.length} not mentioned
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "var(--text-muted)" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {summary.results.map((r) => (
            <ResultRow key={r.llm_name} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultRow({ result }: { result: ScanDetailResult }) {
  const color = result.mentioned ? "var(--text)" : "var(--text-muted)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--bg-dark)" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", minWidth: 70, textTransform: "capitalize" }}>
        {result.llm_name}
      </span>
      <PositionBadge mentioned={result.mentioned} position={result.position} />
      <SentimentBadge sentiment={result.sentiment} />
      {result.score != null && result.score > 0 && (
        <span style={{ fontSize: 11, fontWeight: 700, color: result.score >= 70 ? "#166534" : result.score >= 40 ? "var(--text)" : "#991B1B" }}>
          {result.score}
        </span>
      )}
      {result.competitors_mentioned.length > 0 && (
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          rivals: {result.competitors_mentioned.map((c) => c.name).join(", ")}
        </span>
      )}
    </div>
  );
}

export default function ScanDetailPage() {
  const params = useParams<{ brandId: string; scanId: string }>();
  const brandId = params.brandId;
  const scanId = params.scanId;
  const [data, setData] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId || !scanId) return;
    setLoading(true);
    setError(null);
    getScanResults(brandId, scanId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load scan"))
      .finally(() => setLoading(false));
  }, [brandId, scanId]);

  if (loading) {
    return (
      <div className="page">
        <AppHeader breadcrumb={<Link href={`/brands/${brandId}`} style={{ fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>Scan</Link>} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading scan...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page">
        <AppHeader breadcrumb={<Link href={`/brands/${brandId}`} style={{ fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>Scan</Link>} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
          <div className="card" style={{ color: "var(--red)", fontSize: 13, fontWeight: 600 }}>
            {error || "Scan not found"}
          </div>
        </div>
      </div>
    );
  }

  const mentionRate = data.query_summaries.length > 0
    ? Math.round((data.query_summaries.filter((q) => q.results.some((r) => r.mentioned)).length / data.query_summaries.length) * 100)
    : 0;

  return (
    <div className="page">
      <AppHeader
        breadcrumb={
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <Link href={`/brands/${brandId}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>brand</Link>
            <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Scan Detail</span>
          </div>
        }
      />
      <PageHeader>
        <Link href={`/brands/${brandId}?tab=scans`} className="btn btn-sm btn-ghost btn-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
      </PageHeader>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <ScoreRing score={data.visibility_score ?? 0} size={48} stroke={4} />
            <div>
              <div className="section-label" style={{ marginBottom: 2 }}>Visibility</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                {data.visibility_score != null ? (data.visibility_score >= 70 ? "Strong" : data.visibility_score >= 45 ? "Moderate" : "Low") : "N/A"}
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Mention Rate</div>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{mentionRate}%</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {data.query_summaries.filter((q) => q.results.some((r) => r.mentioned)).length}/{data.query_summaries.length} queries
            </div>
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Duration</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {data.started_at && data.completed_at
                ? `${Math.round((new Date(data.completed_at).getTime() - new Date(data.started_at).getTime()) / 1000)}s`
                : "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {data.completed_at ? new Date(data.completed_at).toLocaleString() : "In progress"}
            </div>
          </div>
        </div>

        {/* Per-query results */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="section-label">Query Results ({data.query_summaries.length})</div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {data.query_summaries.length} queries tested
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.query_summaries.map((q) => (
            <QueryResultCard key={q.query_id} summary={q} />
          ))}
        </div>

        {data.query_summaries.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
            No query results found
          </div>
        )}
      </div>
    </div>
  );
}
