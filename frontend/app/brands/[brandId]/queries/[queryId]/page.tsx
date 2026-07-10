"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getQueryDrilldown, triggerScan } from "@/lib/api";
import type { QueryDrilldown } from "@/types";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { InsightRow, ScoreRing, getLLMColor } from "@/components/ui";

const LLM_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", llama: "Llama",
  deepseek: "DeepSeek", mistral: "Mistral", qwen: "Qwen",
};

function QueryDrilldownInner() {
  const { brandId, queryId } = useParams<{ brandId: string; queryId: string }>();
  const [data, setData] = useState<QueryDrilldown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    setLoading(true);
    setError(null);
    getQueryDrilldown(brandId, queryId)
      .then((d) => { if (!c.signal.aborted) setData(d); })
      .catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [brandId, queryId]);

  const handleRescan = async () => {
    setRescanning(true);
    try { await triggerScan(brandId, ["chatgpt", "gemini", "llama"]); } catch (e) { setError(e instanceof Error ? e.message : "Scan failed"); } finally { setRescanning(false); }
  };

  if (loading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>;
  if (!data) return <div className="page" style={{ padding: "var(--page-px)" }}><div style={{ color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>{error ?? "No data yet."}</div><Link href={`/brands/${brandId}`} style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>Back</Link></div>;

  const mentioned = data.results.filter((r) => r.mentioned);
  const notMentioned = data.results.filter((r) => !r.mentioned);
  const coveragePct = data.total_llms > 0 ? Math.round((data.llms_mentioned / data.total_llms) * 100) : 0;
  const sentimentColor = data.overall_sentiment === "positive" ? "#166534" : data.overall_sentiment === "negative" ? "#991B1B" : "#F59E0B";

  // Collect all competitors mentioned across all LLMs
  const allComps: Record<string, number> = {};
  data.results.forEach((r) => { r.competitors_mentioned.forEach((c) => { allComps[c.name] = (allComps[c.name] || 0) + 1; }); });
  const topComps = Object.entries(allComps).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        breadcrumb={
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>brands</Link>
            <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>/</span>
            <Link href={`/brands/${brandId}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>dashboard</Link>
            <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.query_text}</span>
          </div>
        }
      />
      <PageHeader>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{new Date(data.scanned_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          <button onClick={handleRescan} disabled={rescanning} className="btn btn-ghost btn-sm">{rescanning ? "..." : "Re-scan"}</button>
        </div>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {/* Query hero card */}
        <div className="card sketchy" style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: "24px 28px", marginBottom: "var(--gap)", transform: "rotate(-0.2deg)" }}>
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, left: 24, zIndex: 2 }}>
            <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
            <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
          </svg>

          <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, margin: "0 0 4px", lineHeight: 1, transform: "rotate(-0.3deg)" }}>{data.query_text}</h1>
          <svg width="60%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", marginBottom: 12 }}>
            <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
          </svg>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <ScoreRing score={data.avg_position != null ? Math.max(0, 100 - (data.avg_position - 1) * 20) : 0} size={64} stroke={5} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Coverage
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: coveragePct >= 60 ? "#166534" : coveragePct >= 30 ? "var(--text)" : "#991B1B", lineHeight: 1 }}>{coveragePct}%</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{data.llms_mentioned}/{data.total_llms} models</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sentiment</div>
              <span className="pill" style={{ fontSize: 12, fontWeight: 800, color: sentimentColor, borderColor: sentimentColor, background: "var(--surface)", padding: "4px 10px", textTransform: "capitalize" }}>{data.overall_sentiment}</span>
            </div>
            {data.top_competitor && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top rival</div>
                <Link href={`/brands/${brandId}/competitors/${encodeURIComponent(data.top_competitor)}`} style={{ fontSize: 13, fontWeight: 800, color: "#991B1B", textDecoration: "underline", textUnderlineOffset: 3 }}>{data.top_competitor}</Link>
              </div>
            )}
          </div>
        </div>

        {/* Per-LLM comparison */}
        <div style={{ marginBottom: "var(--gap)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <h2 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, margin: 0, lineHeight: 1, transform: "rotate(-0.3deg)" }}>How each model ranked you</h2>
            <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
          </div>
          <div className="card" style={{ padding: "12px 16px" }}>
            {data.results.map((r, i) => {
              const color = getLLMColor(r.llm_name);
              return (
                <div key={r.id} style={{ padding: "10px 0", borderBottom: i < data.results.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "capitalize", minWidth: 80 }}>{LLM_NAMES[r.llm_name] ?? r.llm_name}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {r.position ? (
                        <span className="pill" style={{ fontSize: 10, fontWeight: 800, background: r.position <= 2 ? "#DCFCE7" : "var(--bg-dark)", color: r.position <= 2 ? "#166534" : "var(--text)", border: `1.5px solid ${r.position <= 2 ? "#166534" : "var(--border)"}` }}>#{r.position}</span>
                      ) : (
                        <span className="pill pill-neg" style={{ fontSize: 10 }}>--</span>
                      )}
                      <span className="pill" style={{ fontSize: 10, fontWeight: 700, background: r.sentiment === "positive" ? "#DCFCE7" : r.sentiment === "negative" ? "#FEE2E2" : "var(--bg-dark)", color: r.sentiment === "positive" ? "#166534" : r.sentiment === "negative" ? "#991B1B" : "var(--text)", border: "1.5px solid var(--border)", textTransform: "capitalize" }}>{r.sentiment}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="bar-track" style={{ flex: 1, height: 10 }}>
                      <div className="bar-fill" style={{ width: `${r.score ?? 0}%`, background: color, borderRadius: 0 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, minWidth: 32, textAlign: "right" }}>{r.score ?? 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Competitors mentioned */}
        {topComps.length > 0 && (
          <div style={{ marginBottom: "var(--gap)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <h2 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, margin: 0, lineHeight: 1, transform: "rotate(-0.3deg)" }}>Competitors mentioned</h2>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {topComps.map(([name, count], i) => (
                <Link key={name} href={`/brands/${brandId}/competitors/${encodeURIComponent(name)}`}
                  style={{
                    background: "#FFF", border: "2px solid var(--border)", borderRadius: "var(--radius)",
                    boxShadow: "2px 2px 0 #1A1A1A, 3px 3px 0 #1A1A1A", padding: "10px 14px",
                    transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`,
                    textDecoration: "none", color: "var(--text)", transition: "transform 0.15s",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(0deg) translate(-1px, -1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`; }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>{count}x</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="card" style={{ borderColor: "var(--primary)", transform: "rotate(0.2deg)", position: "relative" }}>
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

        {/* Collapsible summary */}
        {data.results.some((r) => r.raw_response && !r.raw_response.startsWith("[")) && (
          <div style={{ marginTop: "var(--gap)" }}>
            <details className="card" style={{ padding: "12px 16px" }}>
              <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text-muted)" }}>
                View LLM summary
              </summary>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {data.results.filter((r) => r.raw_response && !r.raw_response.startsWith("[")).map((r) => (
                  <div key={r.id} style={{ padding: "8px 12px", background: "var(--bg-dark)", borderRadius: "var(--radius)", fontSize: 12, fontStyle: "italic", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>{LLM_NAMES[r.llm_name] ?? r.llm_name}:</span> {r.raw_response}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QueryDrilldownPage() {
  return <QueryDrilldownInner />;
}
