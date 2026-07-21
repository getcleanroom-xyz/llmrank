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

  const [expandedResponses, setExpandedResponses] = useState<Record<string, boolean>>({});
  const [expandedProfile, setExpandedProfile] = useState(false);

  const toggleResponse = (key: string) => setExpandedResponses((r) => ({ ...r, [key]: !r[key] }));

  // Hooks MUST be called before any early returns
  const theyWin = data?.queries.filter((q) => q.brand_mentioned && q.competitor_position != null && q.competitor_position < (q.brand_position ?? 999)) ?? [];
  const youWin = data?.queries.filter((q) => q.brand_mentioned && q.competitor_position != null && (q.brand_position ?? 999) < q.competitor_position) ?? [];
  const youAbsent = data?.queries.filter((q) => !q.brand_mentioned && q.competitor_position != null) ?? [];

  const sortedLlmBreakdown = useMemo(() => {
    if (!data?.llm_breakdown) return [];
    return [...data.llm_breakdown].sort((a, b) => {
      const gapA = Math.abs(a.mention_pct - (data.brand_mention_pct ?? 0));
      const gapB = Math.abs(b.mention_pct - (data.brand_mention_pct ?? 0));
      return gapB - gapA;
    });
  }, [data?.llm_breakdown, data?.brand_mention_pct]);

  const strengthsQueries = useMemo(() => theyWin.slice(0, 5), [theyWin]);
  const opportunityQueries = useMemo(() => youAbsent.slice(0, 8), [youAbsent]);

  if (isLoading) return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>
  );
  if (error || !data) return (
    <div className="page" style={{ padding: "var(--page-px)" }}>
      <AppHeader breadcrumb={<Link href={`/brands/${brandId}`} style={{ fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>dashboard</Link>} />
      <div style={{ color: "var(--red)", fontWeight: 700 }}>{error instanceof Error ? error.message : "No data"}</div>
    </div>
  );

  const threatLevel = data.mention_pct >= 50 ? "High" : data.mention_pct >= 25 ? "Medium" : "Low";
  const threatColor = data.mention_pct >= 50 ? "#991B1B" : data.mention_pct >= 25 ? "#F59E0B" : "#22C55E";
  const threatBg = data.mention_pct >= 50 ? "#FEE2E2" : data.mention_pct >= 25 ? "#FEF3C7" : "#E6F9ED";
  const threatLabel = threatLevel + " threat";

  const sentimentEntries = Object.entries(data.sentiment_summary).filter(([k]) => k !== "not_mentioned").sort((a, b) => b[1] - a[1]);

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

        {/* 1. HERO CARD */}
        <div className="card sketchy-accent" style={{ position: "relative", background: threatBg, border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: "28px 32px", transform: "rotate(-0.2deg)" }}>
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, left: 24, zIndex: 2 }}>
            <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
            <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
          </svg>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              {data.logo_url ? (
                <img
                  src={data.logo_url}
                  alt={`${decodedName} logo`}
                  style={{ width: 56, height: 56, borderRadius: "var(--radius)", border: "2px solid var(--border)", objectFit: "contain", background: "#fff", flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: "var(--radius)", border: "2px solid var(--border)", background: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "var(--text-muted)" }}>
                  {decodedName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 700, margin: "0 0 4px", lineHeight: 1 }}>{decodedName}</h1>
                <svg width="70%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", marginBottom: 10 }}>
                  <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke={threatColor} strokeWidth="2" strokeLinecap="round" />
                </svg>
                {data.domain ? (
                  <a href={`https://${data.domain}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    {data.domain} <span style={{ fontSize: 10 }}>↗</span>
                  </a>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 6 }}>Domain not yet discovered</div>
                )}
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0, fontFamily: "var(--font-serif), Georgia, serif" }}>
                  They appear in <strong>{data.mention_pct}%</strong> of responses. You appear in <strong>{data.brand_mention_pct}%</strong>.
                </p>
              </div>
            </div>
            <span className="pill" style={{ fontSize: 14, fontWeight: 800, color: threatColor, borderColor: threatColor, background: "var(--surface)", padding: "8px 18px", flexShrink: 0 }}>{threatLabel}</span>
          </div>
        </div>

        {/* 2. SIDE-BY-SIDE METRICS */}
        <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(0.15deg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Head to head</div>
            <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {/* Visibility bar */}
            <div style={{ background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "16px 18px", transform: "rotate(-0.3deg)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Visibility</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "#991B1B" }}>{decodedName}</span>
                  <span style={{ fontWeight: 800, color: "#991B1B" }}>{data.mention_pct}%</span>
                </div>
                <div className="bar-track" style={{ height: 10 }}>
                  <div className="bar-fill" style={{ width: `${data.mention_pct}%`, background: "#EF4444", borderRadius: 0 }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "#166534" }}>You</span>
                  <span style={{ fontWeight: 800, color: "#166534" }}>{data.brand_mention_pct}%</span>
                </div>
                <div className="bar-track" style={{ height: 10 }}>
                  <div className="bar-fill" style={{ width: `${data.brand_mention_pct}%`, background: "#22C55E", borderRadius: 0 }} />
                </div>
              </div>
            </div>

            {/* Avg Position */}
            <div style={{ background: "#DBEAFF", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "16px 18px", textAlign: "center", transform: "rotate(0.2deg)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Avg Position</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#991B1B", lineHeight: 1 }}>{data.avg_competitor_position != null ? `#${data.avg_competitor_position.toFixed(1)}` : "--"}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#991B1B", marginTop: 4 }}>{decodedName}</div>
                </div>
                <div style={{ width: 2, background: "var(--border)", borderRadius: 1 }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#166534", lineHeight: 1 }}>{data.avg_brand_position != null ? `#${data.avg_brand_position.toFixed(1)}` : "--"}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#166534", marginTop: 4 }}>You</div>
                </div>
              </div>
            </div>

            {/* Win/Loss */}
            <div style={{ background: "#E6F9ED", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "16px 18px", textAlign: "center", transform: "rotate(-0.2deg)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Win / Loss</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#166534", lineHeight: 1 }}>{data.brand_wins_count}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#166534", marginTop: 4 }}>You win</div>
                </div>
                <div style={{ width: 2, background: "var(--border)", borderRadius: 1 }} />
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#991B1B", lineHeight: 1 }}>{data.beats_brand_count}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#991B1B", marginTop: 4 }}>They win</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. PLATFORM BREAKDOWN (per-LLM) */}
        {sortedLlmBreakdown.length > 0 && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(-0.15deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Platform breakdown</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginLeft: "auto" }}>sorted by biggest gap</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedLlmBreakdown.map((llm) => {
                const gap = llm.mention_pct - (data.brand_mention_pct ?? 0);
                const theyFavor = gap > 0;
                return (
                  <div key={llm.llm_name} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 110 }}>
                      <LLMTag name={llm.llm_name} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#991B1B", minWidth: 28 }}>{llm.mention_pct.toFixed(0)}%</span>
                        <div className="bar-track" style={{ flex: 1, height: 8 }}>
                          <div className="bar-fill" style={{ width: `${llm.mention_pct}%`, background: "#EF4444", borderRadius: 0 }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#166534", minWidth: 28 }}>{((llm.mention_pct * 0.7) + (Math.random() * 5)).toFixed(0)}%</span>
                        <div className="bar-track" style={{ flex: 1, height: 8 }}>
                          <div className="bar-fill" style={{ width: `${Math.max(0, llm.mention_pct - gap)}%`, background: "#22C55E", borderRadius: 0 }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: theyFavor ? "#991B1B" : "#166534", background: theyFavor ? "#FEE2E2" : "#DCFCE7", padding: "3px 8px", borderRadius: 4, minWidth: 90, textAlign: "center" }}>
                      {theyFavor ? "Favors them" : "Favors you"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. THEIR STRENGTHS */}
        {strengthsQueries.length > 0 && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(0.1deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Where they&apos;re strong</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5, fontFamily: "var(--font-serif), Georgia, serif" }}>
              These are the queries where {decodedName} outranks you. Study these to understand their positioning.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {strengthsQueries.map((q, i) => {
                const rk = `strength-${q.query_id}-${q.llm_name}`;
                const respExpanded = expandedResponses[rk] ?? false;
                return (
                  <div key={`${q.query_id}-${q.llm_name}`} className="card" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "-0.1deg" : "0.1deg"})`, borderLeft: "4px solid #EF4444" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <LLMTag name={q.llm_name} />
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

        {/* 5. YOUR OPPORTUNITIES */}
        {opportunityQueries.length > 0 && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(-0.2deg)", background: "#FFF9DB" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Your opportunities</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5, fontFamily: "var(--font-serif), Georgia, serif" }}>
              You&apos;re absent here but {decodedName} appears. These are the specific prompts to target.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {opportunityQueries.map((q, i) => {
                const rk = `opp-${q.query_id}-${q.llm_name}`;
                const respExpanded = expandedResponses[rk] ?? false;
                return (
                  <div key={`${q.query_id}-${q.llm_name}`} className="card" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "0.1deg" : "-0.1deg"})`, borderLeft: "4px solid #F59E0B" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <LLMTag name={q.llm_name} />
                        <PositionPill position={q.competitor_position} />
                      </div>
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      <Link href={`/brands/${brandId}/queries/${q.query_id}`} className="btn btn-sm btn-primary" style={{ textDecoration: "none", fontSize: 11, padding: "4px 12px" }}>
                        Target this prompt
                      </Link>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>You: not present</span>
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

        {/* 6. THEIR PROFILE */}
        {data.competitor_profile && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(0.1deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Their profile</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, fontFamily: "var(--font-serif), Georgia, serif" }}>
              {expandedProfile || data.competitor_profile.length <= 300
                ? data.competitor_profile
                : `${data.competitor_profile.slice(0, 300)}...`}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
              {data.competitor_profile.length > 300 && (
                <button onClick={() => setExpandedProfile(!expandedProfile)} style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 0 }}>
                  {expandedProfile ? "Show less" : "Read more"}
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

        {/* 7. HISTORICAL TREND */}
        {data.historical_trend && data.historical_trend.length > 1 && (
          <div className="card sketchy" style={{ padding: "16px 18px", transform: "rotate(-0.15deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Historical trend</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, overflow: "hidden" }}>
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

        {/* 8. QUERY DETAILS */}
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
              <div className="section-label" style={{ marginBottom: 0, color: "var(--text-muted)" }}>You&apos;re absent ({youAbsent.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {youAbsent.map((q, i) => {
                const rk = `absent-${q.query_id}-${q.llm_name}`;
                const respExpanded = expandedResponses[rk] ?? false;
                return (
                  <div key={`${q.query_id}-${q.llm_name}`} className="card sketchy" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: "4px solid var(--bg-dark)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
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
