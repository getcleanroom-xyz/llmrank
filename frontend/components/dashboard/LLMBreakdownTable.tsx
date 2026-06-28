"use client";

import type { LLMBreakdown } from "@/types";
import { LLMTag, getLLMColor, Bar, SentimentPill, PositionPill } from "@/components/ui";

export function LLMBreakdownTable({ data }: { data: LLMBreakdown[] }) {
  if (!data.length) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", fontWeight: 600 }}>No scan data yet.</div>;

  return (
    <div>
      {data.map((row) => (
        <div key={row.llm_name} style={{ padding: "10px 0", borderBottom: "1.5px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <LLMTag name={row.llm_name} />
            <span style={{ fontSize: 16, fontWeight: 800 }}>{row.score}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Bar pct={row.visibility_pct} color={getLLMColor(row.llm_name)} />
            <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 32, textAlign: "right", fontWeight: 600 }}>{row.visibility_pct}%</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <PositionPill position={row.avg_position != null ? Math.round(row.avg_position) : null} />
            <SentimentPill sentiment={(row.sentiment_distribution.positive ?? 0) > (row.sentiment_distribution.negative ?? 0) ? "positive" : (row.sentiment_distribution.negative ?? 0) > 0 ? "negative" : "neutral"} />
          </div>
        </div>
      ))}
    </div>
  );
}
