"use client";

import { Suspense, useState, useCallback, useEffect, lazy } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useDashboard, useCredits } from "@/lib/hooks";
import type { DashboardData } from "@/types";
import { KpiCard, ScoreRing, InsightRow } from "@/components/ui";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { ScanControls } from "@/components/dashboard/DashboardHeader";
import { LLMBreakdownTable } from "@/components/dashboard/LLMBreakdownTable";
import { CompetitorShare } from "@/components/dashboard/CompetitorShare";
import { QueryChipsPanel } from "@/components/dashboard/QueryChipsPanel";
import { QueriesTable } from "@/components/dashboard/QueriesTable";

const ScoreHistoryChart = lazy(() => import("@/components/dashboard/ScoreHistoryChart").then(m => ({ default: m.ScoreHistoryChart })));
const ScanHistory = lazy(() => import("@/components/dashboard/ScanHistory").then(m => ({ default: m.ScanHistory })));

type Tab = "overview" | "queries" | "scans";

function ScribbleUnderline({ color = "var(--primary)", width = "100%", style }: { color?: string; width?: string; style?: React.CSSProperties }) {
  return (
    <svg width={width} height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", ...style }}>
      <path
        d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 5 120 3"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrandDashboardPageInner() {
  const { brandId } = useParams<{ brandId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as Tab) ?? "overview";
  const { user, loading: authLoading } = useAuth();

  const { data: dashResult, isLoading, error: loadError, refetch } = useDashboard(brandId);
  const { data: credits } = useCredits();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/brands");
    }
  }, [user, authLoading, router]);

  if (authLoading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)", minHeight: "100vh" }}>Loading...</div>;
  if (!user) return null;

  const data: DashboardData | null = dashResult?.dashboard ?? null;
  const queries = dashResult?.queries ?? [];

  const setTab = useCallback((t: Tab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    router.replace(`/brands/${brandId}?${p.toString()}`);
  }, [brandId, searchParams, router]);

  const error = loadError ? (loadError instanceof Error ? loadError.message : "Failed to load") : null;
  const [scanError, setScanError] = useState<string | null>(null);

  if (isLoading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>;
  if (!data) return <div className="page" style={{ padding: "var(--page-px)" }}><div style={{ color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>{error ?? "Brand not found."}</div></div>;

  const { brand, latest_scan, active_scan, visibility_score, mention_rate, llm_breakdown, competitor_share, query_summaries, score_history, top_competitor } = data;
  const isScanRunning = active_scan?.status === "pending" || active_scan?.status === "running";
  const prev = score_history.length >= 2 ? score_history[score_history.length - 2] : null;

  const displayQueries = query_summaries.length > 0
    ? query_summaries
    : queries.map(q => ({ query_id: q.id, query_text: q.query_text, results: [] }));

  const insights: { type: "tip" | "warning"; text: string }[] = [];
  if (llm_breakdown.length > 0) {
    const low = llm_breakdown.find((l) => l.visibility_pct < 30);
    if (low) insights.push({ type: "warning", text: `<strong>${low.llm_name} barely mentions you (${low.visibility_pct}%).</strong> Create structured content it can index.` });
  }
  if (top_competitor) insights.push({ type: "warning", text: `<strong>${top_competitor} outranks you.</strong> A comparison page is the highest-leverage move.` });
  if (mention_rate < 30) insights.push({ type: "warning", text: `<strong>Very low mention rate (${mention_rate}%).</strong> Publish FAQs and "best X for Y" content.` });
  else if (mention_rate >= 70) insights.push({ type: "tip", text: `<strong>Strong mention rate (${mention_rate}%).</strong> Focus on improving position.` });
  if (score_history.length < 3) insights.push({ type: "tip", text: "<strong>Run scans weekly</strong> to track changes over time." });

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        breadcrumb={
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>brands</Link>
            <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brand.name}</span>
          </div>
        }
      />
      <PageHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          {isScanRunning && (
            <span className="pill pill-gold" style={{ fontSize: 10, flexShrink: 0 }}>Scanning</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            {(active_scan ?? latest_scan)?.completed_at && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                {new Date((active_scan ?? latest_scan)!.completed_at!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
            <ScanControls brandId={brandId} latestScan={active_scan ?? latest_scan} credits={credits} onScanError={setScanError} />
          </div>
        </div>
      </PageHeader>
      {isScanRunning && <div className="scan-progress" style={{ maxWidth: 1200, margin: "0 auto" }}><div className="scan-progress-fill" /></div>}
      {scanError && <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4px var(--page-px) 0" }}><div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 11, color: "#991B1B", fontWeight: 600 }}>{scanError}</div></div>}
      <div style={{ flex: 1, padding: "var(--gap) var(--page-px)", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {error && data && <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#991B1B", fontWeight: 600 }}>{error}</div>}

        {/* Tab bar */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: "max-content" }}>
            <div
              style={{
                fontFamily: "var(--font-hand), Caveat, cursive",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-muted)",
                marginRight: 8,
                transform: "rotate(-0.5deg)",
                flexShrink: 0,
              }}
            >
              {brand.name}
            </div>
            <div role="tablist" style={{ display: "flex", gap: 4 }}>
              {(["overview", "queries", "scans"] as Tab[]).map((t) => (
                <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)} className={`tab ${t === tab ? "tab-active" : ""}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {tab === "overview" && (
          <>
            <div className="grid-4" style={{ marginBottom: "var(--gap)" }}>
              <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", transform: "rotate(-0.3deg)" }}>
                <ScoreRing score={visibility_score} size={48} stroke={4} />
                <div>
                  <div className="section-label" style={{ marginBottom: 2 }}>Visibility</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                    {visibility_score >= 70 ? "Strong" : visibility_score >= 45 ? "Moderate" : "Low"}
                    {prev && <span style={{ marginLeft: 4, color: visibility_score > prev.visibility_score ? "#166534" : "#991B1B" }}>{visibility_score > prev.visibility_score ? "+" : ""}{Math.round((visibility_score - prev.visibility_score) * 10) / 10}</span>}
                  </div>
                </div>
              </div>
              <KpiCard label="Queries" value={data.queries_monitored} sub={`${llm_breakdown.length || "-"} LLMs`} />
              <KpiCard label="Mention rate" value={`${mention_rate}%`} sub={<> {mention_rate >= 60 ? "Good" : "Low"}{prev && <span style={{ marginLeft: 4, color: mention_rate > prev.mention_rate ? "#166534" : "#991B1B" }}>{mention_rate > prev.mention_rate ? "+" : ""}{Math.round((mention_rate - prev.mention_rate) * 10) / 10}</span>}</>} subColor={mention_rate >= 60 ? "#166534" : "#991B1B"} />
              <KpiCard label="Top competitor" value={top_competitor ?? "-"} sub={top_competitor ? "Outranks you" : "None"} subColor={top_competitor ? "#991B1B" : "var(--text-muted)"} />
            </div>

            <div className="grid-2" style={{ marginBottom: "var(--gap)" }}>
              <div className="card" style={{ transform: "rotate(-0.2deg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>LLM breakdown</div>
                  <svg width="30" height="8" viewBox="0 0 30 8" fill="none">
                    <path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
                <LLMBreakdownTable data={llm_breakdown} />
              </div>
              <div className="card" style={{ transform: "rotate(0.2deg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Competitor share</div>
                  <svg width="30" height="8" viewBox="0 0 30 8" fill="none">
                    <path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
                <CompetitorShare items={competitor_share} brandName={brand.name} brandScore={mention_rate} />
              </div>
            </div>

            <div className="dashboard-bottom-grid" style={{ marginBottom: "var(--gap)" }}>
              <div className="card dashboard-bottom-queries" style={{ transform: "rotate(-0.2deg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Queries</div>
                  <svg width="30" height="8" viewBox="0 0 30 8" fill="none">
                    <path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
                <QueryChipsPanel queries={displayQueries} brandId={brandId} onManageQueries={() => setTab("queries")} />
              </div>
              <div className="card" style={{ transform: "rotate(0.2deg)" }}>
                <div className="section-label" style={{ marginBottom: 10 }}>Score history</div>
                <Suspense fallback={<div className="skeleton" style={{ height: 150 }} />}>
                  <ScoreHistoryChart data={score_history} />
                </Suspense>
              </div>
              {insights.length > 0 && (
                <div className="card" style={{ borderColor: "var(--primary)", transform: "rotate(0.3deg)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div className="section-label" style={{ marginBottom: 0 }}>Insights</div>
                    <svg width="30" height="8" viewBox="0 0 30 8" fill="none">
                      <path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                  </div>
                  {insights.map((ins, i) => <div key={i} style={i === insights.length - 1 ? { borderBottom: "none" } : {}}><InsightRow type={ins.type} text={ins.text} /></div>)}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "queries" && (
          <div style={{ maxWidth: 900 }}>
            <QueriesTable brandId={brandId} brandName={brand.name} domain={brand.domain} />
          </div>
        )}

        {tab === "scans" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <h2
                style={{
                  fontFamily: "var(--font-hand), Caveat, cursive",
                  fontSize: "clamp(22px, 3vw, 28px)",
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1,
                  transform: "rotate(-0.3deg)",
                }}
              >
                Scan history
              </h2>
              <ScribbleUnderline color="var(--primary)" width="100px" />
            </div>
            <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
              <ScanHistory brandId={brandId} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

export function BrandDashboardClient() {
  return (
    <Suspense fallback={<div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)", minHeight: "100vh" }}>Loading...</div>}>
      <BrandDashboardPageInner />
    </Suspense>
  );
}
