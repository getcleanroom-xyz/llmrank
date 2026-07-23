"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { rescanQuery } from "@/lib/api";
import { useQueryDrilldown } from "@/lib/hooks";
import { PageHeader } from "@/components/AppHeader";
import { InsightRow, getLLMColor } from "@/components/ui";
import { SENTIMENT_LABELS, LLM_NAMES } from "@/lib/utils";

function QueryResultRow({ r, i, color, total, hasRawResponse }: { r: any; i: number; color: string; total: number; hasRawResponse: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ padding: "10px 0", borderBottom: i < total - 1 ? "1px solid var(--border)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "capitalize", minWidth: 80 }}>{LLM_NAMES[r.llm_name] ?? r.llm_name}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {r.position != null && r.position > 0 ? (
            <span className="pill" style={{ fontSize: 10, fontWeight: 800, background: r.position <= 2 ? "#DCFCE7" : "var(--bg-dark)", color: r.position <= 2 ? "#166534" : "var(--text)", border: "2px solid var(--border)" }}>#{r.position}</span>
          ) : (
            <span className="pill pill-neg" style={{ fontSize: 10 }}>--</span>
          )}
          <span className="pill" style={{ fontSize: 10, fontWeight: 700, background: r.sentiment === "positive" ? "#DCFCE7" : r.sentiment === "negative" ? "#FEE2E2" : "var(--bg-dark)", color: r.sentiment === "positive" ? "#166534" : r.sentiment === "negative" ? "#991B1B" : "var(--text)", border: "2px solid var(--border)" }}>
            {SENTIMENT_LABELS[r.sentiment] ?? "Unmentioned"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="bar-track" style={{ flex: 1, height: 10 }}>
          <div className="bar-fill" style={{ width: `${r.score ?? 0}%`, background: color, borderRadius: 0 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, minWidth: 28, textAlign: "right" }}>{r.score ?? 0}</span>
        {hasRawResponse && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 10, fontWeight: 600, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", whiteSpace: "nowrap" }}
          >
            {expanded ? "Hide" : "Response"}
          </button>
        )}
      </div>
      {expanded && hasRawResponse && (
        <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--bg-dark)", border: "1.5px solid var(--border)", fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", fontFamily: "var(--font-serif), Georgia, serif", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {r.raw_response}
        </div>
      )}
    </div>
  );
}

function QueryDrilldownInner() {
  const { brandId, queryId } = useParams<{ brandId: string; queryId: string }>();
  const { data, isFetching, error: loadError, refetch } = useQueryDrilldown(brandId, queryId);
  const [rescanning, setRescanning] = useState(false);
  const [rescanId, setRescanId] = useState<string | null>(null);
  const [rescanError, setRescanError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for re-scan completion
  useEffect(() => {
    if (!rescanId) return;
    pollRef.current = setInterval(async () => {
      const result = await refetch();
      if (result.isSuccess) {
        setRescanId(null);
        setRescanning(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [rescanId, refetch]);

  const handleRescan = async () => {
    setRescanning(true);
    setRescanError(null);
    try {
      const { scan_id } = await rescanQuery(brandId, queryId);
      setRescanId(scan_id);
    } catch (err) {
      setRescanning(false);
      setRescanError(err instanceof Error ? err.message : "Re-scan failed");
    }
  };

  if (isFetching && !data) return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {/* Query hero skeleton */}
        <div style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", padding: "24px 28px", marginBottom: "var(--gap)", transform: "rotate(-0.2deg)" }}>
          <div className="skeleton" style={{ width: "80%", height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: "60%", height: 8 }} />
        </div>

        {/* Stat pills skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ padding: "12px 14px" }}>
              <div className="skeleton" style={{ width: "50%", height: 20, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: "40%", height: 8, marginBottom: 4 }} />
              <div className="skeleton" style={{ width: "60%", height: 8 }} />
            </div>
          ))}
        </div>

        {/* LLM results skeleton */}
        <div className="card" style={{ padding: "8px 16px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div className="skeleton" style={{ width: 80, height: 14 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <div className="skeleton" style={{ width: 40, height: 18 }} />
                  <div className="skeleton" style={{ width: 60, height: 18 }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="skeleton" style={{ flex: 1, height: 10 }} />
                <div className="skeleton" style={{ width: 30, height: 14 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  if (!data) return <div className="page" style={{ padding: "var(--page-px)" }}><div style={{ color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>{loadError instanceof Error ? loadError.message : "No data yet."}</div><Link href={`/brands/${brandId}`} style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>Back</Link></div>;

  const mentioned = data.results.filter((r) => r.mentioned);
  const notMentioned = data.results.filter((r) => !r.mentioned);
  const coveragePct = data.total_llms > 0 ? Math.round((data.llms_mentioned / data.total_llms) * 100) : 0;
  const sentimentLabel = data.overall_sentiment === "positive" ? "Positive" : data.overall_sentiment === "negative" ? "Negative" : data.overall_sentiment === "neutral" ? "Neutral" : "Mixed";
  const sentimentColor = data.overall_sentiment === "positive" ? "#166534" : data.overall_sentiment === "negative" ? "#991B1B" : "#F59E0B";
  const hasScan = data.results.length > 0;

  // Top competitors across all LLMs
  const allComps: Record<string, number> = {};
  data.results.forEach((r) => { r.competitors_mentioned.forEach((c) => { allComps[c.name] = (allComps[c.name] || 0) + 1; }); });
  const topComps = Object.entries(allComps).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader>
        <Link href={`/brands/${brandId}`} className="btn btn-sm btn-ghost btn-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        {rescanError && (
          <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 11, color: "#991B1B", fontWeight: 600, flex: 1 }}>
            {rescanError}
            <button onClick={() => setRescanError(null)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "#991B1B" }}>x</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: rescanError ? undefined : "auto" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{new Date(data.scanned_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          <button onClick={handleRescan} disabled={rescanning} className="btn btn-primary btn-sm">{rescanning ? "Scanning..." : "Re-scan"}</button>
        </div>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {/* Query hero */}
        <div className="card sketchy" style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", padding: "24px 28px", marginBottom: "var(--gap)", transform: "rotate(-0.2deg)" }}>
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, left: 24, zIndex: 2 }}>
            <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
            <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
          </svg>
          <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 700, margin: "0 0 4px", lineHeight: 1, transform: "rotate(-0.3deg)" }}>{data.query_text}</h1>
          <svg width="60%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", marginBottom: 8 }}>
            <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Stat pills — redesigned row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
          {[
            { val: data.avg_position != null ? `#${data.avg_position}` : "-", label: "Position", sub: data.avg_position != null && data.avg_position <= 2 ? "Strong" : data.avg_position ? "Room to improve" : "Not ranked", bg: "#FFF9DB", acc: data.avg_position != null && data.avg_position <= 2 ? "var(--primary)" : "var(--text-muted)" },
            { val: `${coveragePct}%`, label: "Coverage", sub: `${data.llms_mentioned}/${data.total_llms} models`, bg: "#DBEAFF", acc: coveragePct >= 60 ? "#166534" : coveragePct >= 30 ? "#333" : "#991B1B" },
            { val: data.top_competitor ?? "-", label: "Top rival", sub: data.top_competitor ? "Most-cited" : "None detected", bg: "#FEE2E2", acc: data.top_competitor ? "#991B1B" : "#999" },
            { val: sentimentLabel, label: "Sentiment", sub: data.overall_sentiment === "positive" ? "Favorable" : data.overall_sentiment === "negative" ? "Unfavorable" : data.overall_sentiment === "neutral" ? "Neutral" : "Mixed", bg: "#E6F9ED", acc: sentimentColor },
          ].map((s, i) => (
            <div key={s.label} className="card sketchy" style={{ background: s.bg, padding: "12px 14px", transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.acc, lineHeight: 1.1, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 1 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Per-LLM comparison rows */}
        {hasScan && (
          <div style={{ marginBottom: "var(--gap)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <h2 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, margin: 0, lineHeight: 1, transform: "rotate(-0.3deg)" }}>How each model ranked you</h2>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div className="card" style={{ padding: "8px 16px" }}>
              {data.results.map((r, i) => {
                const color = getLLMColor(r.llm_name);
                const hasRawResponse = Boolean(r.raw_response && !r.raw_response.startsWith("[Error") && !r.raw_response.startsWith("[Empty"));
                return (
                  <QueryResultRow key={r.id} r={r} i={i} color={color} total={data.results.length} hasRawResponse={hasRawResponse} />
                );
              })}
            </div>
          </div>
        )}

        {/* Competitor chips */}
        {topComps.length > 0 && (
          <div style={{ marginBottom: "var(--gap)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <h2 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, margin: 0, lineHeight: 1, transform: "rotate(-0.3deg)" }}>Competitors mentioned</h2>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {topComps.map(([name, count], i) => (
                <Link key={name} href={`/brands/${brandId}/competitors/${encodeURIComponent(encodeURIComponent(name))}`}
                  className="card sketchy"
                  style={{ padding: "10px 14px", background: "#FFF", transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`, textDecoration: "none", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(0deg) translate(-1px, -1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{name}</div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)" }}>{count}x</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="card sketchy-accent" style={{ position: "relative" }}>
            <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, right: 24, zIndex: 2 }}>
              <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
              <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>How to improve</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            {data.insights.map((ins, i) => <div key={i} style={i === data.insights.length - 1 ? { borderBottom: "none" } : {}}><InsightRow type={ins.type as "tip" | "warning"} text={ins.text} /></div>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function QueryDrilldownPage() {
  return <QueryDrilldownInner />;
}
