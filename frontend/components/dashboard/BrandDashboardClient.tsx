"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useDashboard } from "@/lib/hooks";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardData, MonitoredQuery } from "@/types";
import { ScoreRing, InsightRow } from "@/components/ui";
import { LLMBreakdownTable } from "@/components/dashboard/LLMBreakdownTable";
import { CompetitorShare } from "@/components/dashboard/CompetitorShare";
import { QueryChipsPanel } from "@/components/dashboard/QueryChipsPanel";
import { QueriesTable } from "@/components/dashboard/QueriesTable";
import { CompetitorsTab } from "@/components/dashboard/CompetitorsTab";
import { ScoreHistoryChart } from "@/components/dashboard/ScoreHistoryChart";
import { ScanHistory } from "@/components/dashboard/ScanHistory";
import { ChatWidget } from "@/components/ChatWidget";
import { DashboardSkeleton } from "@/components/dashboard/Skeletons";

type Tab = "overview" | "queries" | "scans" | "competitors";

function Scribble({ color = "var(--primary)", style }: { color?: string; style?: React.CSSProperties }) {
  return (
    <svg width="60" height="10" viewBox="0 0 60 10" fill="none" style={{ display: "block", opacity: 0.5, ...style }}>
      <path d="M0 5 Q8 1 16 6 Q24 9 32 3 Q40 1 48 6 Q56 9 60 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function DoodleCircle({ color = "var(--primary)", style }: { color?: string; style?: React.CSSProperties }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ display: "block", opacity: 0.25, pointerEvents: "none", ...style }}>
      <ellipse cx="16" cy="16" rx="14" ry="14" stroke={color} strokeWidth="1.5" strokeDasharray="2 3" fill="none" />
    </svg>
  );
}

interface BrandDashboardClientProps {
  brandId: string;
  initialData?: DashboardData | null;
  initialQueries?: MonitoredQuery[];
}

function BrandDashboardPageInner({ brandId, initialData, initialQueries }: BrandDashboardClientProps) {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const tab = (searchParams.get("tab") as Tab) ?? "overview";

  const { data: dashResult, error: loadError, refetch } = useDashboard(brandId);
  const qc = useQueryClient();
  const [scanComplete, setScanComplete] = useState(false);
  const [optimisticScanning, setOptimisticScanning] = useState(false);
  const wasRunningRef = useRef(false);

  const freshData = dashResult?.dashboard ?? null;
  const data: DashboardData | null = freshData ?? initialData ?? null;
  const queries = dashResult?.queries ?? initialQueries ?? [];
  const isScanRunning = optimisticScanning || (data && (data.active_scan?.status === "pending" || data.active_scan?.status === "running"));

  const prevOptimisticRef = useRef(optimisticScanning);
  useEffect(() => {
    if (prevOptimisticRef.current && !optimisticScanning && data?.active_scan) {
      setOptimisticScanning(false);
    }
    prevOptimisticRef.current = optimisticScanning;
  }, [optimisticScanning, data?.active_scan]);

  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });

  useEffect(() => {
    if (!isScanRunning) {
      if (wasRunningRef.current) {
        setScanComplete(true);
        qc.invalidateQueries({ queryKey: queryKeys.dashboard(brandId) });
        setTimeout(() => setScanComplete(false), 10000);
        wasRunningRef.current = false;
      }
      return;
    }
    wasRunningRef.current = true;
    const interval = setInterval(() => {
      refetchRef.current();
    }, 5000);
    return () => clearInterval(interval);
  }, [isScanRunning, brandId, qc]);

  // Redirect if not authenticated (client-side fallback)
  useEffect(() => {
    if (!authLoading && !user) window.location.href = "/brands";
  }, [user, authLoading]);

  if (authLoading) return <DashboardSkeleton />;
  if (!user) return null;
  if (!data) return <DashboardSkeleton />;

  const error = loadError ? (loadError instanceof Error ? loadError.message : "Failed to load") : null;

  const { brand, latest_scan, active_scan, visibility_score, mention_rate, llm_breakdown, competitor_share, query_summaries, score_history, top_competitor } = data;
  const prev = score_history.length >= 2 ? score_history[score_history.length - 2] : null;
  const hasScan = latest_scan && latest_scan.status === "completed";

  const displayQueries = query_summaries.length > 0
    ? query_summaries
    : queries.map(q => ({ query_id: q.id, query_text: q.query_text, results: [] }));

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Scan status bar */}
      <div style={{ width: "100%", padding: "0 var(--page-px)", background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, padding: "var(--gap) 0" }}>
          {isScanRunning && <span className="pill pill-gold" style={{ fontSize: 10, flexShrink: 0 }}>Scanning</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            {(active_scan ?? latest_scan)?.completed_at && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                Last scanned {new Date((active_scan ?? latest_scan)!.completed_at!).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        {isScanRunning && <div className="scan-progress"><div className="scan-progress-fill" /></div>}
        {scanComplete && (
          <div style={{ background: "#DCFCE7", border: "2px solid #22C55E", borderRadius: "var(--radius)", padding: "8px 14px", fontSize: 12, color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, boxShadow: "2px 2px 0 #1A1A1A", marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 18 }}>Done!</span> Scan complete. Your results have been updated.
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "0 var(--page-px)", width: "100%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) 0" }}>
        {error && data && <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#991B1B", fontWeight: 600 }}>{error}</div>}

        {tab === "overview" && (
          <>
            {!hasScan && queries.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: "48px 24px", marginBottom: "var(--gap)", background: "#FFF9DB", border: "2px solid var(--border)", boxShadow: "3px 3px 0 #1A1A1A", transform: "rotate(-0.3deg)" }}>
                <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ display: "block", margin: "0 auto 12px" }}>
                  <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
                  <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
                </svg>
                <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, marginBottom: 8, lineHeight: 1.1 }}>
                  Run your first scan to see your AI visibility
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 400, margin: "0 auto" }}>
                  We&apos;ll check how your brand appears across ChatGPT, Gemini, Claude, and other AI models — then show you where you stand.
                </div>
              </div>
            )}

            {hasScan && (
              <div
                className="card sketchy-accent"
                style={{
                  position: "relative",
                  background: "#FFF9DB",
                  border: "2px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px)",
                  marginBottom: "var(--gap)",
                  display: "flex",
                  alignItems: "center",
                  gap: "clamp(16px, 4vw, 40px)",
                  flexWrap: "wrap",
                  transform: "rotate(-0.2deg)",
                }}
              >
                <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, left: 24, zIndex: 2 }}>
                  <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
                  <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
                </svg>

                <DoodleCircle color="var(--primary)" style={{ position: "absolute", right: 30, bottom: 20 }} />

                <div style={{ flexShrink: 0 }}>
                  <ScoreRing score={visibility_score} size={100} stroke={5} />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                    Visibility Score
                  </div>
                  <div style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, lineHeight: 1, marginBottom: 4 }}>
                    {visibility_score}
                    <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600, marginLeft: 6 }}>
                      / 100
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 18, color: visibility_score >= 70 ? "#166534" : visibility_score >= 45 ? "#F59E0B" : "#991B1B", fontWeight: 700 }}>
                    {visibility_score >= 70 ? "Strong" : visibility_score >= 45 ? "Moderate" : "Needs work"}
                    {prev && <span style={{ marginLeft: 6, fontSize: 14 }}>{visibility_score > prev.visibility_score ? "+" : ""}{Math.round((visibility_score - prev.visibility_score) * 10) / 10} pts</span>}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "var(--gap)" }}>
              {[
                { val: `${mention_rate}%`, label: "mention rate", bg: "#FFF9DB", acc: "var(--primary)", rot: "-0.3deg" },
                { val: data.queries_monitored, label: "queries", bg: "#DBEAFF", acc: "#3B82F6", rot: "0.4deg" },
                { val: top_competitor ?? "none", label: "top competitor", bg: top_competitor ? "#FEE2E2" : "#E6F9ED", acc: top_competitor ? "#991B1B" : "#22C55E", rot: "-0.4deg" },
                { val: llm_breakdown.length || "-", label: "LLMs tracked", bg: "#F3E8FF", acc: "#A855F7", rot: "0.3deg" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="card sketchy"
                  style={{
                    background: s.bg,
                    border: "2px solid var(--border)",
                    borderRadius: "var(--radius)",
                    boxShadow: "3px 3px 0 #1A1A1A",
                    padding: "10px 16px",
                    transform: `rotate(${s.rot})`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    flex: "1 1 140px",
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 800, color: s.acc, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{s.val}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{s.label}</span>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ marginBottom: "var(--gap)" }}>
              <div className="card" style={{ position: "relative", transform: "rotate(-0.15deg)", borderTop: "4px solid var(--primary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>LLM breakdown</div>
                  <Scribble color="var(--primary)" />
                </div>
                <LLMBreakdownTable data={llm_breakdown} />
                <DoodleCircle color="var(--primary)" style={{ position: "absolute", top: -12, right: -8 }} />
              </div>
              <div className="card" style={{ position: "relative", transform: "rotate(0.15deg)", borderTop: "4px solid #3B82F6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Competitor share</div>
                  <Scribble color="#3B82F6" />
                </div>
                <CompetitorShare items={competitor_share} brandName={brand.name} brandScore={mention_rate} />
              </div>
            </div>

            <div style={{ textAlign: "center", margin: "10px 0 8px", opacity: 0.3 }}>
              <svg width="180" height="28" viewBox="0 0 180 28" fill="none">
                <path d="M10 14 Q20 8 35 14 Q50 20 65 14 Q80 8 95 14 Q110 20 125 14 Q140 8 155 14 Q165 18 175 14" stroke="var(--primary)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M42 6 Q46 2 50 6 Q54 2 58 6" stroke="#3B82F6" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M85 8 L88 4 M85 8 L82 6" stroke="#22C55E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <circle cx="128" cy="8" r="3" stroke="#A855F7" strokeWidth="1.5" fill="none" />
                <path d="M165 4 Q168 8 170 4" stroke="#F97316" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>

            <div className="dashboard-bottom-grid" style={{ marginBottom: "var(--gap)" }}>
              <div className="card dashboard-bottom-queries" style={{ position: "relative", transform: "rotate(-0.15deg)", borderTop: "4px solid #22C55E" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Queries</div>
                  <Scribble color="#22C55E" />
                </div>
                <QueryChipsPanel queries={displayQueries} brandId={brandId} onManageQueries={() => window.location.href = `/brands/${brandId}?tab=queries`} />
              </div>
              <div className="card" style={{ transform: "rotate(0.15deg)", borderTop: "4px solid #A855F7" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Score history</div>
                  <Scribble color="#A855F7" />
                </div>
                <ScoreHistoryChart data={score_history} />
              </div>
              {data.insights?.length > 0 && (
                <div className="card" style={{ borderColor: "var(--primary)", position: "relative", transform: "rotate(0.2deg)", borderTop: "4px solid var(--primary)" }}>
                  <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, right: 24, zIndex: 2 }}>
                    <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
                    <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
                  </svg>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div className="section-label" style={{ marginBottom: 0 }}>Insights</div>
                    <Scribble color="var(--primary)" />
                  </div>
                  {data.insights.map((ins, i) => <div key={i} style={i === data.insights.length - 1 ? { borderBottom: "none" } : {}}><InsightRow type={ins.type as "tip" | "warning"} text={ins.text} /></div>)}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "queries" && (
          <QueriesTable brandId={brandId} brandName={brand.name} domain={brand.domain} />
        )}

        {tab === "scans" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16 }}>
              <h2 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 700, margin: 0, lineHeight: 1, transform: "rotate(-0.3deg)" }}>Scan history</h2>
            </div>
            <ScanHistory brandId={brandId} />
          </div>
        )}

        {tab === "competitors" && <CompetitorsTab brandId={brandId} />}
      </div>
      </div>

      <ChatWidget brandId={brandId} />
    </div>
  );
}

export function BrandDashboardClient({ brandId, initialData, initialQueries }: BrandDashboardClientProps) {
  return <BrandDashboardPageInner brandId={brandId} initialData={initialData} initialQueries={initialQueries} />;
}
