"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCompetitorDrilldown } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { getLLMColor } from "@/components/ui";

export default function CompetitorDrilldownPage() {
  const { brandId, competitorName } = useParams<{ brandId: string; competitorName: string }>();
  const decodedName = decodeURIComponent(competitorName);
  const { data, isLoading, error } = useCompetitorDrilldown(brandId, decodedName);

  const llmGroups = useMemo(() => {
    if (!data) return {};
    const groups: Record<string, typeof data.queries> = {};
    for (const q of data.queries) { (groups[q.llm_name] ??= []).push(q); }
    return groups;
  }, [data]);

  if (isLoading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>;
  if (error || !data) return (
    <div className="page" style={{ padding: "var(--page-px)" }}>
      <AppHeader breadcrumb={<Link href={`/brands/${brandId}`} style={{ fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>dashboard</Link>} />
      <div style={{ color: "var(--red)", fontWeight: 700 }}>{error instanceof Error ? error.message : "No data"}</div>
    </div>
  );

  const theyWin = data.queries.filter((q) => q.brand_mentioned && q.competitor_position != null && q.competitor_position < (q.brand_position ?? 999));
  const youWin = data.queries.filter((q) => q.brand_mentioned && q.competitor_position != null && (q.brand_position ?? 999) < q.competitor_position);
  const youAbsent = data.queries.filter((q) => !q.brand_mentioned);
  const bothAbsent = data.queries.filter((q) => !q.brand_mentioned && q.competitor_position == null);

  const threatLabel = data.mention_pct >= 50 ? "High threat" : data.mention_pct >= 25 ? "Medium threat" : "Low threat";
  const threatColor = data.mention_pct >= 50 ? "#991B1B" : data.mention_pct >= 25 ? "#F59E0B" : "#22C55E";
  const threatBg = data.mention_pct >= 50 ? "#FEE2E2" : data.mention_pct >= 25 ? "#FEF3C7" : "#E6F9ED";

  // Compute "where they beat you" patterns
  const theyBeatYouIn = Object.entries(llmGroups).map(([llm, queries]) => {
    const wins = queries.filter((q) => q.brand_mentioned && q.competitor_position != null && q.competitor_position < (q.brand_position ?? 999)).length;
    return { llm, wins, total: queries.length, pct: queries.length > 0 ? Math.round((wins / queries.length) * 100) : 0 };
  }).filter((x) => x.wins > 0).sort((a, b) => b.pct - a.pct);

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

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>

        {/* Hero card */}
        <div className="card sketchy-accent" style={{ position: "relative", background: threatBg, border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: "28px 32px", marginBottom: "var(--gap)", transform: "rotate(-0.2deg)" }}>
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
                    Appears in <strong>{data.mention_pct}%</strong> of all AI responses ({data.total_appearances} out of {data.total_queries * 4}).
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

        {/* Actionable insight */}
        {data.insight && (
          <div style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "14px 18px", marginBottom: "var(--gap)", transform: "rotate(0.2deg)" }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ position: "absolute", top: -9, left: 12, zIndex: 2 }}>
              <ellipse cx="8" cy="4" rx="4" ry="4" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.2" />
              <rect x="6.5" y="8" width="3" height="6" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.2" />
            </svg>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-serif), Georgia, serif", marginTop: 4 }}>
              {data.insight}
            </div>
          </div>
        )}

        {/* Head-to-head */}
        <div className="card sketchy" style={{ padding: "16px 18px", marginBottom: "var(--gap)", transform: "rotate(0.15deg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Head to head</div>
            <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div className="card sketchy" style={{ background: "#E6F9ED", padding: "12px 14px", textAlign: "center", transform: "rotate(-0.3deg)" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#22C55E", lineHeight: 1 }}>{youWin.length}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>You rank higher</div>
            </div>
            <div className="card sketchy" style={{ background: "#FEE2E2", padding: "12px 14px", textAlign: "center", transform: "rotate(0.3deg)" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#EF4444", lineHeight: 1 }}>{theyWin.length}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#991B1B", textTransform: "uppercase" }}>{decodedName} ranks higher</div>
            </div>
            <div className="card sketchy" style={{ background: "var(--bg-dark)", padding: "12px 14px", textAlign: "center", transform: "rotate(-0.2deg)" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-muted)", lineHeight: 1 }}>{youAbsent.length}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>You not mentioned</div>
            </div>
          </div>
        </div>

        {/* Where they beat you — per LLM */}
        {theyBeatYouIn.length > 0 && (
          <div className="card sketchy" style={{ padding: "16px 18px", marginBottom: "var(--gap)", transform: "rotate(-0.2deg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Where they beat you</div>
              <svg width="40" height="8" viewBox="0 0 40 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5 Q35 7 40 4" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {theyBeatYouIn.map(({ llm, wins, total, pct }) => (
                <div key={llm} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "capitalize", minWidth: 70, textAlign: "right", flexShrink: 0 }}>{llm}</span>
                  <div className="bar-track" style={{ flex: 1, height: 10 }}>
                    <div className="bar-fill" style={{ width: `${pct}%`, background: getLLMColor(llm), borderRadius: 0 }} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{wins}/{total} ahead</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
              {theyBeatYouIn[0]?.pct >= 50
                ? `${decodedName} dominates ${theyBeatYouIn[0].llm} — focus your visibility efforts there.`
                : `${decodedName} has an edge in ${theyBeatYouIn.length} model${theyBeatYouIn.length > 1 ? "s" : ""}, but the gaps are closable.`
              }
            </div>
          </div>
        )}

        {/* Doodle divider */}
        <div style={{ textAlign: "center", margin: "8px 0 14px", opacity: 0.25 }}>
          <svg width="180" height="16" viewBox="0 0 180 16" fill="none">
            <path d="M5 8 Q20 2 40 8 Q60 14 80 8 Q100 2 120 8 Q140 14 160 8 L175 8" stroke="#991B1B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <circle cx="90" cy="10" r="3" stroke="#EF4444" strokeWidth="1.5" fill="none" />
            <circle cx="125" cy="6" r="2" stroke="#A855F7" strokeWidth="1.5" fill="none" />
          </svg>
        </div>

        {/* They're ahead */}
        {theyWin.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0, color: "#991B1B" }}>They rank higher ({theyWin.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {theyWin.map((q, i) => (
                <div key={`${q.query_id}-${q.llm_name}`} className="card sketchy" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: "4px solid #EF4444", background: "#FFF9DB" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "capitalize", flexShrink: 0 }}>{q.llm_name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, alignItems: "center", marginTop: 2 }}>
                    <span style={{ color: "#991B1B", fontWeight: 700 }}>{decodedName} #{q.competitor_position}</span>
                    <span style={{ color: "var(--text-muted)" }}>You #{q.brand_position}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* You're ahead */}
        {youWin.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0, color: "#166534" }}>You rank higher ({youWin.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {youWin.map((q, i) => (
                <div key={`${q.query_id}-${q.llm_name}`} className="card sketchy" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: "4px solid #22C55E", background: "#E6F9ED" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "capitalize", flexShrink: 0 }}>{q.llm_name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, alignItems: "center", marginTop: 2 }}>
                    <span style={{ color: "#166534", fontWeight: 700 }}>You #{q.brand_position}</span>
                    <span style={{ color: "var(--text-muted)" }}>{decodedName} #{q.competitor_position}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* You're absent */}
        {youAbsent.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0, color: "var(--text-muted)" }}>You&apos;re not mentioned ({youAbsent.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>
              {decodedName} is mentioned in these queries but you are not. These are your biggest visibility gaps.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {youAbsent.filter((q) => q.competitor_position != null).map((q, i) => (
                <div key={`${q.query_id}-${q.llm_name}`} className="card sketchy" style={{ padding: "10px 14px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: "4px solid var(--bg-dark)", background: "var(--surface)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</Link>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "capitalize", flexShrink: 0 }}>{q.llm_name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, alignItems: "center", marginTop: 2 }}>
                    <span style={{ color: "#991B1B", fontWeight: 700 }}>{decodedName} #{q.competitor_position}</span>
                    <span style={{ color: "var(--text-muted)" }}>You: not present</span>
                  </div>
                </div>
              ))}
              {bothAbsent.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>
                  Neither of you mentioned in {bothAbsent.length} other queries.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {data.queries.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No data yet</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>Run a scan to see how {decodedName} compares to your brand.</div>
            <Link href={`/brands/${brandId}`} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Go to dashboard</Link>
          </div>
        )}
      </div>
    </div>
  );
}
