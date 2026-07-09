"use client";

import { useParams, useRouter } from "next/navigation";
import type { LLMBreakdown } from "@/types";
import { LLMTag, getLLMColor, Bar, SentimentPill, PositionPill } from "@/components/ui";

export function LLMBreakdownTable({ data }: { data: LLMBreakdown[] }) {
  const { brandId } = useParams<{ brandId: string }>();
  const router = useRouter();

  if (!data.length) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", fontWeight: 600 }}>No scan data yet.</div>;

  return (
    <div>
      {data.map((row) => (
        <div
          key={row.llm_name}
          onClick={() => router.push(`/brands/${brandId}/llms/${encodeURIComponent(row.llm_name)}`)}
          style={{ padding: "10px 0", borderBottom: "1.5px solid var(--border)", cursor: "pointer", transition: "background 0.1s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-dark)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <LLMTag name={row.llm_name} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{row.score}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
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
