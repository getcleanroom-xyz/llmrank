"use client";

import { useRouter } from "next/navigation";
import type { QuerySummary } from "@/types";

function PositionTag({ mentioned, position }: { mentioned: boolean; position: number | null }) {
  if (!mentioned) return <span className="pill pill-neg">--</span>;
  if (position === null || position === undefined) return <span className="pill pill-neu">?</span>;
  return <span className={position <= 2 ? "pill pill-pos" : position <= 4 ? "pill pill-neu" : "pill pill-neg"}>#{position}</span>;
}

export function QueryChipsPanel({ queries, brandId, onManageQueries }: { queries: QuerySummary[]; brandId: string; onManageQueries?: () => void }) {
  const router = useRouter();

  if (!queries.length) return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8, fontWeight: 600 }}>No query data yet</div>
      {onManageQueries && <button onClick={onManageQueries} className="btn btn-sm">Add queries</button>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {queries.map((q) => (
        <div key={q.query_id} role="button" tabIndex={0} onClick={() => router.push(`/brands/${brandId}/queries/${q.query_id}`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/brands/${brandId}/queries/${q.query_id}`); } }} style={{ background: "var(--bg-dark)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", cursor: "pointer", transition: "box-shadow 0.1s, transform 0.1s" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow)"; e.currentTarget.style.transform = "translate(-1px, -1px)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{q.query_text}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {q.results.map((r) => (
              <div key={r.llm_name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize", fontWeight: 600 }}>{r.llm_name}</span>
                <PositionTag mentioned={r.mentioned} position={r.position} />
                {r.score != null && r.score > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: r.score >= 70 ? "#166534" : r.score >= 40 ? "var(--text)" : "#991B1B" }}>
                    {r.score}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
