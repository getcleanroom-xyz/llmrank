"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCompetitorDrilldown } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { PositionPill, SentimentPill, getLLMColor, LLMTag } from "@/components/ui";

export default function CompetitorDrilldownPage() {
  const { brandId, competitorName } = useParams<{ brandId: string; competitorName: string }>();
  const decodedName = decodeURIComponent(competitorName);
  const { data, isLoading, error } = useCompetitorDrilldown(brandId, decodedName);

  const [expandedProfiles, setExpandedProfiles] = useState<Record<string, boolean>>({});
  const [expandedResponses, setExpandedResponses] = useState<Record<string, boolean>>({});

  const toggleProfile = (key: string) => setExpandedProfiles((p) => ({ ...p, [key]: !p[key] }));
  const toggleResponse = (key: string) => setExpandedResponses((r) => ({ ...r, [key]: !r[key] }));

  if (isLoading) return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>
  );
  if (error || !data) return (
    <div className="page" style={{ padding: "var(--page-px)" }}>
      <AppHeader breadcrumb={<Link href={`/brands/${brandId}`} style={{ fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>dashboard</Link>} />
      <div style={{ color: "var(--red)", fontWeight: 700 }}>{error instanceof Error ? error.message : "No data"}</div>
    </div>
  );

  const theyWin = data.queries.filter((q) => q.brand_mentioned && q.competitor_position != null && q.competitor_position < (q.brand_position ?? 999));
  const youWin = data.queries.filter((q) => q.brand_mentioned && q.competitor_position != null && (q.brand_position ?? 999) < q.competitor_position);
  const youAbsent = data.queries.filter((q) => !q.brand_mentioned && q.competitor_position != null);

  const threatLabel = data.mention_pct >= 50 ? "High threat" : data.mention_pct >= 25 ? "Medium threat" : "Low threat";
  const threatColor = data.mention_pct >= 50 ? "#991B1B" : data.mention_pct >= 25 ? "#F59E0B" : "#22C55E";
  const threatBg = data.mention_pct >= 50 ? "#FEE2E2" : data.mention_pct >= 25 ? "#FEF3C7" : "#E6F9ED";

  const totalResponses = data.total_queries * 4;

  const sentimentEntries = Object.entries(data.sentiment_summary).sort((a, b) => b[1] - a[1]);
  const dominantSentiment = sentimentEntries.length > 0 ? sentimentEntries[0][0] : null;
  const sentimentLabel = (() => {
    const pos = data.sentiment_summary["positive"] ?? 0;
    const neg = data.sentiment_summary["negative"] ?? 0;
    const neu = data.sentiment_summary["neutral"] ?? 0;
    const total = pos + neg + neu;
    if (total === 0) return "No sentiment data";
    const ratio = Math.max(pos, neg, neu) / total;
    if (ratio > 0.6) return `Mostly ${dominantSentiment}`;
    return "Mixed sentiment";
  })();

  const profileText = data.competitor_profile || "";
  const profilePreview = profileText.slice(0, 300);
  const profileKey = "profile";
  const profileExpanded = expandedProfiles[profileKey] ?? false;

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        breadcrumb={
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>brands</Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <Link href={`/brands/${brandId}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>dashboard</Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <Link href={`/brands/${brandId}?tab=competitors`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>competitors</Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{decodedName}</span>
          </div>
        }
      />
      <PageHeader>
        <Link href={`/brands/${brandId}?tab=competitors`} className="btn btn-sm btn-ghost btn-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>

        <div className="card sketchy-accent" style={{ position: "relative", background: threatBg, border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: "28px 32px", transform: "rotate(-0.2deg)" }}>
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, left: 24, zIndex: 2 }}>
            <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
            <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
          </svg>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              {data.logo_url && (
                <img
                  src={data.logo_url}
                  alt={`${decodedName} logo`}
                  style={{ width: 56, height: 56, borderRadius: "var(--radius)", border: "2px solid var(--border)", objectFit: "contain", background: "#fff", flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div>
                <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 700, margin: "0 0 4px", lineHeight: 1 }}>{decodedName}</h1>
                <svg width="70%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", marginBottom: 10 }}>
                  <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke={threatColor} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0, fontFamily: "var(--font-serif), Georgia, serif" }}>
                    Appears in <strong>{data.mention_pct}%</strong> of all AI responses ({data.total_appearances} out of {totalResponses}).
                    {data.beats_brand_count > 0
                      ? <> Ranks ahead of you in <strong style={{ color: "#991B1B" }}>{data.beats_brand_count}</strong> queries.</>
                      : <> Never ranks ahead of you when both are mentioned.</>
                    }
                  </p>
                  {data.domain && (
                    <a href={`https://${data.domain}`} target="_blank" rel="noopener noreferrer"
                      className="btn btn-sm"
                      style={{ textDecoration: "none", fontSize: 11, padding: "5px 12px" }}>
                      Visit {data.domain} ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
            <span className="pill" style={{ fontSize: 14, fontWeight: 800, color: threatColor, borderColor: threatColor, background: "var(--surface)", padding: "8px 18px", flexShrink: 0 }}>{threatLabel}</span>
          </div>
        </div>

        {data.insight && (
          <div style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "14px 18px", transform: "rotate(0.2deg)" }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ position: "absolute", top: -9, left: 12, zIndex: 2 }}>
              <ellipse cx="8" cy="4" rx="4" ry="4" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.2" />
              <rect x="6.5" y="8" width="3" height="6" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.2" />
            </svg>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-serif), Georgia, serif", marginTop: 4 }}>
              {data.insight}
            </div>
          </div>
        )}

        <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(0.15deg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Head to head</div>
            <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <div className="card sketchy" style={{ background: "#E6F9ED", padding: "12px 14px", textAlign: "center", transform: "rotate(-0.3deg)" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#22C55E", lineHeight: 1 }}>{youWin.length}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>You rank higher</div>
              {data.avg_brand_position != null && (
                <div style={{ fontSize: 10, color: "#166534", marginTop: 2, fontWeight: 600 }}>Avg pos: #{data.avg_brand_position.toFixed(1)}</div>
              )}
            </div>
            <div className="card sketchy" style={{ background: "#FEE2E2", padding: "12px 14px", textAlign: "center", transform: "rotate(0.3deg)" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#EF4444", lineHeight: 1 }}>{theyWin.length}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#991B1B", textTransform: "uppercase" }}>{decodedName} ranks higher</div>
              {data.avg_competitor_position != null && (
                <div style={{ fontSize: 10, color: "#991B1B", marginTop: 2, fontWeight: 600 }}>Avg pos: #{data.avg_competitor_position.toFixed(1)}</div>
              )}
            </div>
            <div className="card sketchy" style={{ background: "var(--bg-dark)", padding: "12px 14px", textAlign: "center", transform: "rotate(-0.2deg)" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-muted)", lineHeight: 1 }}>{data.both_absent_count}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Neither mentioned</div>
            </div>
          </div>
        </div>

        {data.llm_breakdown && data.llm_breakdown.length > 0 && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(-0.2deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Where they beat you per LLM</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.llm_breakdown
                .filter((x) => x.competitor_wins > 0)
                .sort((a, b) => b.competitor_wins - a.competitor_wins)
                .map((llm) => {
                  const pct = llm.total > 0 ? Math.round((llm.competitor_wins / llm.total) * 100) : 0;
                  return (
                    <div key={llm.llm_name} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <LLMTag name={llm.llm_name} />
                      <div className="bar-track" style={{ flex: 1, minWidth: 80, height: 10 }}>
                        <div className="bar-fill" style={{ width: `${pct}%`, background: getLLMColor(llm.llm_name), borderRadius: 0 }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, minWidth: 100, flexShrink: 0 }}>{llm.competitor_wins}/{llm.total} ahead</span>
                    </div>
                  );
                })}
            </div>
            {data.llm_breakdown.filter((x) => x.competitor_wins > 0).length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 12 }}>No LLMs where they rank higher.</div>
            )}
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
              {data.llm_breakdown.filter((x) => x.competitor_wins > 0).sort((a, b) => (b.competitor_wins / (b.total || 1)) - (a.competitor_wins / (a.total || 1)))[0]?.competitor_wins > 0
                ? `${decodedName} dominates ${data.llm_breakdown.filter((x) => x.competitor_wins > 0).sort((a, b) => (b.competitor_wins / (b.total || 1)) - (a.competitor_wins / (a.total || 1)))[0].llm_name} — focus your visibility efforts there.`
                : `${decodedName} has an edge in ${data.llm_breakdown.filter((x) => x.competitor_wins > 0).length} model${data.llm_breakdown.filter((x) => x.competitor_wins > 0).length !== 1 ? "s" : ""}, but the gaps are closable.`
              }
            </div>
          </div>
        )}

        {profileText && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(0.1deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Their profile</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, fontFamily: "var(--font-serif), Georgia, serif" }}>
              {profileExpanded || profileText.length <= 300
                ? profileText
                : `${profilePreview}...`}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
              {profileText.length > 300 && (
                <button onClick={() => toggleProfile(profileKey)} style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 0 }}>
                  {profileExpanded ? "Show less" : "Read more"}
                </button>
              )}
              {data.domain && (
                <a href={`https://${data.domain}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", fontWeight: 600 }}>
                  Visit {data.domain} ↗
                </a>
              )}
            </div>
          </div>
        )}

        {data.historical_trend && data.historical_trend.length > 1 && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(-0.15deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Historical trend</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60, overflow: "hidden" }}>
              {(() => {
                const maxVal = Math.max(...data.historical_trend.map((t) => t.mention_pct), 1);
                return data.historical_trend.map((t, i) => {
                  const h = Math.max((t.mention_pct / maxVal) * 100, 4);
                  return (
                    <div key={i} style={{ flex: 1, minWidth: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 24,
                          height: `${h}%`,
                          background: getLLMColor(t.mention_pct >= 30 ? "high" : "low"),
                          border: "1px solid var(--border)",
                          borderRadius: 0,
                          transition: "height 0.3s",
                        }}
                        title={`${t.date}: ${t.mention_pct}%`}
                      />
                      <span style={{ fontSize: 8, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.date.slice(5)}</span>
                    </div>
                  );
                });
              })()}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>
              <span>{data.historical_trend[0].date}</span>
              <span>{data.historical_trend[data.historical_trend.length - 1].date}</span>
            </div>
          </div>
        )}

        {sentimentEntries.length > 0 && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(0.2deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Sentiment</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{sentimentLabel}</span>
              {sentimentEntries.map(([sentiment, count]) => (
                <SentimentPill key={sentiment} sentiment={sentiment} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {sentimentEntries.map(([sentiment, count]) => {
                const total = sentimentEntries.reduce((s, [, c]) => s + c, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const colors = { positive: "#22C55E", neutral: "#888", negative: "#EF4444" } as Record<string, string>;
                return (
                  <span key={sentiment} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                    <span style={{ width: 8, height: 8, background: colors[sentiment] ?? "#888", display: "inline-block" }} />
                    {sentiment}: {count} ({pct}%)
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {theyWin.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0, color: "#991B1B" }}>They rank higher ({theyWin.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {theyWin.map((q, i) => {
                const rk = `they-${q.query_id}-${q.llm_name}`;
                const respExpanded = expandedResponses[rk] ?? false;
                return (
                  <div key={`${q.query_id}-${q.llm_name}`} className="card sketchy" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: "4px solid #EF4444", background: "#FFF9DB" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <LLMTag name={q.llm_name} />
                        <SentimentPill sentiment={q.sentiment} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 11, alignItems: "center", marginTop: 4 }}>
                      <PositionPill position={q.competitor_position} />
                      <span style={{ color: "var(--text-muted)" }}>vs</span>
                      <PositionPill position={q.brand_position} />
                    </div>
                    {q.raw_response && (
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => toggleResponse(rk)} style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 0 }}>
                          {respExpanded ? "Hide response" : "Show response"}
                        </button>
                        {respExpanded && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-serif), Georgia, serif", whiteSpace: "pre-wrap", background: "var(--surface)", padding: "8px 10px", border: "1px solid var(--border)" }}>
                            {q.raw_response}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {youWin.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0, color: "#166534" }}>You rank higher ({youWin.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {youWin.map((q, i) => {
                const rk = `you-${q.query_id}-${q.llm_name}`;
                const respExpanded = expandedResponses[rk] ?? false;
                return (
                  <div key={`${q.query_id}-${q.llm_name}`} className="card sketchy" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: "4px solid #22C55E", background: "#E6F9ED" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <LLMTag name={q.llm_name} />
                        <SentimentPill sentiment={q.sentiment} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 11, alignItems: "center", marginTop: 4 }}>
                      <PositionPill position={q.brand_position} />
                      <span style={{ color: "var(--text-muted)" }}>vs</span>
                      <PositionPill position={q.competitor_position} />
                    </div>
                    {q.raw_response && (
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => toggleResponse(rk)} style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 0 }}>
                          {respExpanded ? "Hide response" : "Show response"}
                        </button>
                        {respExpanded && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-serif), Georgia, serif", whiteSpace: "pre-wrap", background: "var(--surface)", padding: "8px 10px", border: "1px solid var(--border)" }}>
                            {q.raw_response}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {youAbsent.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0, color: "var(--text-muted)" }}>You&apos;re not mentioned ({youAbsent.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5, fontFamily: "var(--font-serif), Georgia, serif" }}>
              These are your biggest visibility gaps — {decodedName} appears in these queries but you don&apos;t.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {youAbsent.map((q, i) => {
                const rk = `absent-${q.query_id}-${q.llm_name}`;
                const respExpanded = expandedResponses[rk] ?? false;
                return (
                  <div key={`${q.query_id}-${q.llm_name}`} className="card sketchy" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: "4px solid var(--bg-dark)", background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <LLMTag name={q.llm_name} />
                        <SentimentPill sentiment={q.sentiment} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 11, alignItems: "center", marginTop: 4 }}>
                      <PositionPill position={q.competitor_position} />
                      <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 10 }}>You: not present</span>
                    </div>
                    {q.raw_response && (
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => toggleResponse(rk)} style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 0 }}>
                          {respExpanded ? "Hide response" : "Show response"}
                        </button>
                        {respExpanded && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-serif), Georgia, serif", whiteSpace: "pre-wrap", background: "var(--surface)", padding: "8px 10px", border: "1px solid var(--border)" }}>
                            {q.raw_response}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data.queries.length === 0 && (
          <div className="card sketchy" style={{ textAlign: "center", padding: 40, transform: "rotate(-0.1deg)" }}>
            <svg width="32" height="40" viewBox="0 0 32 40" fill="none" style={{ margin: "0 auto 12px" }}>
              <ellipse cx="16" cy="6" rx="6" ry="6" fill="#888" stroke="#1A1A1A" strokeWidth="1.5" />
              <rect x="13" y="12" width="6" height="16" rx="1.5" fill="#666" stroke="#1A1A1A" strokeWidth="1.5" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No data yet</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Run a scan to see how {decodedName} compares to your brand.
            </div>
            <Link href={`/brands/${brandId}`} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Go to dashboard</Link>
          </div>
        )}
      </div>
    </div>
  );
}
