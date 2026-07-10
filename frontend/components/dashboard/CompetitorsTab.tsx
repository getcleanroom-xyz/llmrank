"use client";

import { useRouter, useParams } from "next/navigation";
import { useDashboard } from "@/lib/hooks";

const COMP_COLORS = ["#22C55E", "#3B82F6", "#F97316", "#EF4444", "#A855F7", "#F59E0B"];

export function CompetitorsTab({ brandId }: { brandId: string }) {
  const { data: dashResult } = useDashboard(brandId);
  const router = useRouter();
  const { brandId: bid } = useParams<{ brandId: string }>();

  const data = dashResult?.dashboard;
  const competitorShare = data?.competitor_share ?? [];
  const mentionRate = data?.mention_rate ?? 0;
  const brandName = data?.brand?.name ?? "";

  if (!data) return <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No scan data yet.</div>;

  const maxPct = Math.max(...competitorShare.map((c) => c.mention_pct), mentionRate);

  return (
    <div>
      {/* Heading */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 700, margin: "0 0 2px", lineHeight: 1, transform: "rotate(-0.3deg)" }}>Competitors</h1>
        <svg width="160" height="6" viewBox="0 0 160 6" preserveAspectRatio="none" style={{ display: "block" }}>
          <path d="M0 3 Q10 0 20 5 Q30 8 40 3 Q50 0 60 6 Q70 8 80 2 Q90 0 100 5 Q110 8 120 3 Q130 0 140 5 Q150 8 160 3" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {/* Share chart */}
      <div className="card" style={{ padding: "16px 18px", marginBottom: "var(--gap)", transform: "rotate(-0.15deg)" }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Mention share</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[{ name: brandName, pct: mentionRate, mine: true }, ...competitorShare.map((c) => ({ name: c.name, pct: c.mention_pct, mine: false }))].sort((a, b) => b.pct - a.pct).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, minWidth: 100, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{item.name}</span>
              <div className="bar-track" style={{ flex: 1, height: 10, background: item.mine ? undefined : "var(--bg-dark)" }}>
                <div className="bar-fill" style={{ width: `${(item.pct / (maxPct || 1)) * 100}%`, background: item.mine ? "var(--primary)" : COMP_COLORS[i % COMP_COLORS.length], borderRadius: 0 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36, textAlign: "right", flexShrink: 0 }}>{item.pct}%</span>
            </div>
          ))}
        </div>
        {competitorShare.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>No competitors detected yet</div>}
      </div>

      {/* Recommendations */}
      {competitorShare.length > 0 && (
        <div className="card" style={{ padding: "14px 18px", marginBottom: "var(--gap)", borderColor: "var(--primary)", transform: "rotate(0.15deg)", background: "#FFF9DB" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Recommendations</div>
            <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
          </div>
          {competitorShare.slice(0, 3).map((c, i) => (
            <div key={c.name} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: i < 2 ? 6 : 0, paddingLeft: 12, borderLeft: `2px solid ${COMP_COLORS[i % COMP_COLORS.length]}` }}>
              <strong>{c.name}</strong> appears in {c.mention_pct}% of responses. Publishing a <strong>&quot;{brandName} vs {c.name}&quot;</strong> comparison page is your highest-impact action.
            </div>
          ))}
        </div>
      )}

      {/* Competitor detail cards */}
      <div className="section-label" style={{ marginBottom: 10 }}>Competitor detail</div>
      <div className="grid-2">
        {competitorShare.map((c, i) => {
          const col = COMP_COLORS[i % COMP_COLORS.length];
          return (
            <div
              key={c.name}
              className="card sketchy"
              onClick={() => router.push(`/brands/${bid}/competitors/${encodeURIComponent(c.name)}`)}
              style={{
                padding: "14px 16px",
                cursor: "pointer",
                transform: `rotate(${i % 2 === 0 ? "-0.2deg" : "0.2deg"})`,
                background: "#FFF",
                border: "2px solid var(--border)",
                boxShadow: "2px 2px 0 #1A1A1A, 3px 3px 0 #1A1A1A",
                transition: "box-shadow 0.15s, transform 0.15s",
                position: "relative",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A, 5px 5px 0 #1A1A1A"; e.currentTarget.style.transform = "rotate(0deg) translate(-1px, -1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "2px 2px 0 #1A1A1A, 3px 3px 0 #1A1A1A"; e.currentTarget.style.transform = `rotate(${i % 2 === 0 ? "-0.2deg" : "0.2deg"})`; }}
            >
              {/* Top color accent */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: col, borderRadius: "2px 2px 0 0" }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, marginTop: 4 }}>{c.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="bar-track" style={{ flex: 1, height: 8 }}>
                  <div className="bar-fill" style={{ width: `${(c.mention_pct / (maxPct || 1)) * 100}%`, background: col, borderRadius: 0 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{c.mention_pct}%</span>
              </div>
              <div style={{ color: "var(--text-muted)", marginTop: 4, fontWeight: 600, fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 13 }}>click for detail &rarr;</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
