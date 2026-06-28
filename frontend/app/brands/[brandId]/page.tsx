"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getDashboard, getQueries } from "@/lib/api";
import type { DashboardData, MonitoredQuery } from "@/types";
import { KpiCard, ScoreRing, InsightRow } from "@/components/ui";
import { Sidebar } from "@/components/ui/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { LLMBreakdownTable } from "@/components/dashboard/LLMBreakdownTable";
import { CompetitorShare } from "@/components/dashboard/CompetitorShare";
import { QueryChipsPanel } from "@/components/dashboard/QueryChipsPanel";
import { QueryManager } from "@/components/dashboard/QueryManager";
import { ScoreHistoryChart } from "@/components/dashboard/ScoreHistoryChart";
import { ScanHistory } from "@/components/dashboard/ScanHistory";

type Tab = "overview" | "queries" | "scans";

export default function BrandDashboardPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [queries, setQueries] = useState<MonitoredQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const abortRef = useRef<AbortController | null>(null);

  const loadDashboard = useCallback(async () => {
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    try {
      setError(null);
      const [dash, qs] = await Promise.all([getDashboard(brandId), getQueries(brandId)]);
      if (!c.signal.aborted) { setData(dash); setQueries(qs); }
    } catch (err) {
      if (!c.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [brandId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadDashboard(); return () => abortRef.current?.abort(); }, [loadDashboard]);

  useEffect(() => {
    const scan = data?.active_scan;
    if (!scan || scan.status === "completed" || scan.status === "failed") return;
    const i = setInterval(loadDashboard, 4000);
    return () => clearInterval(i);
  }, [data?.active_scan, loadDashboard]);

  if (loading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>;
  if (!data) return <div className="page" style={{ padding: "var(--page-px)" }}><div style={{ color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>{error ?? "Brand not found."}</div></div>;

  const { brand, latest_scan, active_scan, visibility_score, mention_rate, llm_breakdown, competitor_share, query_summaries, score_history, top_competitor } = data;
  const prev = score_history.length >= 2 ? score_history[score_history.length - 2] : null;

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
    <div className="page" style={{ display: "flex" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashboardHeader brand={brand} latestScan={active_scan ?? latest_scan} onScanTriggered={loadDashboard} onRefresh={loadDashboard} />
        <div style={{ flex: 1, padding: "var(--gap) var(--page-px)", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {error && data && <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#991B1B", fontWeight: 600 }}>{error}</div>}

        <div role="tablist" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {(["overview", "queries", "scans"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)} className={`tab ${t === tab ? "tab-active" : ""}`}>{t}</button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <div className="grid-4" style={{ marginBottom: "var(--gap)" }}>
              <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
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
              <div className="card"><div className="section-label" style={{ marginBottom: 10 }}>LLM breakdown</div><LLMBreakdownTable data={llm_breakdown} /></div>
              <div className="card"><div className="section-label" style={{ marginBottom: 10 }}>Competitor share</div><CompetitorShare items={competitor_share} brandName={brand.name} brandScore={mention_rate} /></div>
            </div>

            {/* Queries + Score History + Insights — asymmetric 2-column */}
            <div className="dashboard-bottom-grid" style={{ marginBottom: "var(--gap)" }}>
              {/* Queries — spans full left column */}
              <div className="card dashboard-bottom-queries">
                <div className="section-label" style={{ marginBottom: 10 }}>Queries</div>
                <QueryChipsPanel queries={query_summaries} brandId={brandId} onManageQueries={() => setTab("queries")} />
              </div>

              {/* Score History — top right */}
              <div className="card">
                <div className="section-label" style={{ marginBottom: 10 }}>Score history</div>
                <ScoreHistoryChart data={score_history} />
              </div>

              {/* Insights — bottom right */}
              {insights.length > 0 && (
                <div className="card" style={{ borderColor: "var(--primary)" }}>
                  <div className="section-label" style={{ marginBottom: 10 }}>Insights</div>
                  {insights.map((ins, i) => <div key={i} style={i === insights.length - 1 ? { borderBottom: "none" } : {}}><InsightRow type={ins.type} text={ins.text} /></div>)}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "queries" && <div className="card" style={{ maxWidth: 640 }}><div className="section-label" style={{ marginBottom: 14 }}>Manage queries</div><QueryManager brandId={brandId} brandName={brand.name} domain={brand.domain} queries={queries} onUpdate={loadDashboard} /></div>}

        {tab === "scans" && (
          <div>
            <div className="section-label" style={{ marginBottom: 12 }}>Scan history</div>
            <ScanHistory brandId={brandId} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
