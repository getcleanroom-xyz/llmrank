"use client";

import { useState, useMemo } from "react";
import { useScans, useScanDetail } from "@/lib/hooks";
import { timeAgo, SENTIMENT_LABELS, PositionBadge } from "@/lib/utils";
import { FilterBar, type FilterState } from "./FilterBar";

function ScoreChart({ scans }: { scans: { id: string; visibility_score: number | null; completed_at: string | null }[] }) {
  const completed = scans.filter((s) => s.visibility_score != null && s.completed_at);
  if (completed.length < 2) return null;

  // Check if multiple scans share the same day
  const dayCounts: Record<string, number> = {};
  completed.forEach((s) => {
    const day = new Date(s.completed_at!).toLocaleDateString();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const hasMultipleSameDay = Object.values(dayCounts).some((c) => c > 1);

  const width = 600;
  const height = 120;
  const padding = { top: 10, right: 20, bottom: 24, left: 36 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const scores = completed.map((s) => s.visibility_score!);
  const min = Math.max(0, Math.min(...scores) - 10);
  const max = Math.min(100, Math.max(...scores) + 10);
  const range = max - min || 1;

  const points = completed.map((s, i) => {
    const dt = new Date(s.completed_at!);
    let label: string;
    if (hasMultipleSameDay) {
      label = dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        + " " + dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } else {
      label = dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return {
      x: padding.left + (i / (completed.length - 1)) * chartW,
      y: padding.top + (1 - (s.visibility_score! - min) / range) * chartH,
      id: s.id,
      score: s.visibility_score!,
      date: s.completed_at!,
      label,
    };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Area fill
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // Y-axis ticks
  const yTicks = [min, min + range / 2, max].map((v) => ({
    value: Math.round(v),
    y: padding.top + (1 - (v - min) / range) * chartH,
  }));

  return (
    <div style={{
      background: "var(--surface)",
      border: "2px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "16px",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8 }}>
        Score History
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={padding.left} y1={tick.y}
              x2={width - padding.right} y2={tick.y}
              stroke="var(--bg-dark)" strokeWidth="1"
            />
            <text
              x={padding.left - 6} y={tick.y + 4}
              textAnchor="end" fontSize="10" fill="var(--text-muted)"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaD} fill="var(--primary)" opacity="0.15" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r="4" fill="var(--primary)" stroke="var(--border)" strokeWidth="1.5" />
        ))}

        {/* X-axis labels (every few points) */}
        {points.filter((_, i) => i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 5)) === 0).map((p) => (
          <text key={p.id} x={p.x} y={height - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ExpandedScan({ scanId, brandId }: { scanId: string; brandId: string }) {
  const { data, isLoading, error } = useScanDetail(brandId, scanId);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  if (isLoading) return <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-muted)" }}>Loading results...</div>;
  if (error) return <div style={{ padding: "8px 0", fontSize: 11, color: "var(--red)" }}>{error instanceof Error ? error.message : "Failed to load"}</div>;
  if (!data || data.query_summaries.length === 0) return <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-muted)" }}>No prompt results</div>;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1.5px solid var(--bg-dark)" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.query_summaries.map((q) => {
          const isOpen = expandedQuery === q.query_id;
          const mentionedCount = q.results.filter((r) => r.mentioned).length;
          const totalCount = q.results.length;

          return (
            <div key={q.query_id}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpandedQuery(isOpen ? null : q.query_id); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "6px 8px", fontSize: 12, fontWeight: 600,
                  background: isOpen ? "var(--bg-dark)" : "transparent",
                  border: "1px solid transparent", borderRadius: "var(--radius)",
                  cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "var(--bg-dark)"; }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</span>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{mentionedCount}/{totalCount}</span>
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
                      <span style={{ color: r.sentiment === "positive" ? "#166534" : r.sentiment === "negative" ? "#991B1B" : "var(--text-muted)", fontSize: 10 }}>{SENTIMENT_LABELS[r.sentiment] ?? "Unmentioned"}</span>
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
  const [filters, setFilters] = useState<FilterState>({
    dateRange: "30d",
    scoreMin: "",
    scoreMax: "",
    search: "",
    status: "all",
  });

  const filteredScans = useMemo(() => {
    return scans.filter((scan) => {
      if (filters.status === "completed" && scan.status !== "completed") return false;
      if (filters.status === "running" && scan.status !== "running") return false;
      if (filters.status === "failed" && scan.status !== "failed") return false;
      if (filters.scoreMin && scan.visibility_score != null && scan.visibility_score < parseInt(filters.scoreMin)) return false;
      if (filters.scoreMax && scan.visibility_score != null && scan.visibility_score > parseInt(filters.scoreMax)) return false;
      return true;
    });
  }, [scans, filters]);

  if (isLoading) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", fontWeight: 600 }}>Loading scans...</div>;
  if (!scans.length) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", fontWeight: 600 }}>No scans yet.</div>;

  return (
    <div>
      {/* Score chart */}
      <ScoreChart scans={scans} />

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        showStatus={true}
        showScore={true}
        statusOptions={[
          { label: "All", value: "all" },
          { label: "Completed", value: "completed" },
          { label: "Running", value: "running" },
          { label: "Failed", value: "failed" },
        ]}
      />

      {/* Timeline */}
      <div style={{ position: "relative", paddingLeft: 20 }}>
        {/* Vertical connector line */}
        <div style={{
          position: "absolute", left: 8, top: 0, bottom: 0,
          width: 2, background: "var(--border)",
        }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredScans.map((scan, i) => {
            const isExpanded = expandedId === scan.id;
            const scoreColor = scan.visibility_score != null
              ? scan.visibility_score >= 70 ? "#22C55E" : scan.visibility_score >= 40 ? "var(--primary)" : "#EF4444"
              : "var(--text-muted)";

            return (
              <div key={scan.id} style={{ position: "relative" }}>
                {/* Timeline dot */}
                <div style={{
                  position: "absolute", left: -16, top: 14,
                  width: 12, height: 12, borderRadius: "50%",
                  background: scan.status === "completed" ? scoreColor : "var(--bg-dark)",
                  border: "2px solid var(--border)",
                  zIndex: 1,
                }} />

                {/* Card */}
                <div
                  className="card"
                  onClick={() => setExpandedId(isExpanded ? null : scan.id)}
                  style={{
                    padding: "12px 14px",
                    cursor: "pointer",
                    borderLeft: `4px solid ${scan.status === "completed" ? scoreColor : scan.status === "failed" ? "#EF4444" : "var(--bg-dark)"}`,
                    transition: "box-shadow 0.15s, transform 0.15s",
                    transform: `rotate(${i % 2 === 0 ? "-0.1deg" : "0.1deg"})`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-hover)"; e.currentTarget.style.transform = "rotate(0deg) translate(-1px, -1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow)"; e.currentTarget.style.transform = `rotate(${i % 2 === 0 ? "-0.1deg" : "0.1deg"})`; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                          ? new Date(scan.completed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : scan.status === "running" ? "In progress..." : "Started"}
                      </div>
                    </div>

                    {scan.status === "completed" && (
                      <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor }}>
                            {scan.visibility_score ?? "-"}
                          </div>
                          <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>score</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 800 }}>
                            {scan.mention_rate != null ? `${scan.mention_rate}%` : "-"}
                          </div>
                          <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>mentions</div>
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
                    <ExpandedScan scanId={scan.id} brandId={brandId} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
