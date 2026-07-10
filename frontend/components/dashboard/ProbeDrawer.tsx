"use client";

import type { ProbeResult } from "@/lib/api";

const REC_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  keep: { bg: "#E6F9ED", border: "#22C55E", text: "#166534" },
  drop: { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B" },
  refine: { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E" },
};

export function ProbeDrawer({ probe, onClose }: { probe: ProbeResult | null; onClose: () => void }) {
  if (!probe) return null;

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(360px, 90vw)", background: "var(--surface)", borderLeft: "2px solid var(--border)", zIndex: 50, boxShadow: "-4px 0 0 #1A1A1A", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", borderBottom: "2px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 22, fontWeight: 700 }}>Probe results</div>
        <button onClick={onClose} className="btn btn-ghost btn-sm">x</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <div className="card" style={{ padding: 12, marginBottom: 14, background: "#FFF9DB", borderColor: "var(--primary)", transform: "rotate(-0.2deg)" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{probe.summary}</div>
        </div>

        <div className="section-label" style={{ marginBottom: 10 }}>Per-query analysis</div>
        {probe.insights.map((ins, i) => {
          const rc = REC_COLORS[ins.recommendation] || REC_COLORS.refine;
          return (
            <div key={i} className="card" style={{ padding: 10, marginBottom: 8, borderLeft: `4px solid ${rc.border}`, transform: `rotate(${i % 2 === 0 ? "-0.2deg" : "0.2deg"})` }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{ins.query_text}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10, marginBottom: 4 }}>
                {ins.brand_overmentioned && <span className="pill" style={{ background: "#FEE2E2", borderColor: "#EF4444", color: "#991B1B" }}>overmentioned</span>}
                {ins.competitors_found.map((c) => (
                  <span key={c} className="pill pill-neu" style={{ fontSize: 9 }}>{c}</span>
                ))}
              </div>
              <span className="pill" style={{ fontSize: 9, background: rc.bg, borderColor: rc.border, color: rc.text, fontWeight: 700 }}>{ins.recommendation.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
