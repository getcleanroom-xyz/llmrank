"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useLLMDrilldown } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { PositionPill, SentimentPill } from "@/components/ui";

export default function LLMDrilldownPage() {
  const { brandId, llmName } = useParams<{ brandId: string; llmName: string }>();
  const decodedName = decodeURIComponent(llmName);
  const { data, isLoading, error } = useLLMDrilldown(brandId, llmName);

  if (isLoading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>;
  if (error || !data) return (
    <div className="page" style={{ padding: "var(--page-px)" }}>
      <AppHeader breadcrumb={<Link href={`/brands/${brandId}`} style={{ fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>dashboard</Link>} />
      <div style={{ color: "var(--red)", fontWeight: 700 }}>{error instanceof Error ? error.message : "No data"}</div>
    </div>
  );

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        breadcrumb={
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>brands</Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <Link href={`/brands/${brandId}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>dashboard</Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{decodedName}</span>
          </div>
        }
      />
      <PageHeader>
        <Link href={`/brands/${brandId}`} className="btn btn-sm btn-ghost btn-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
          {new Date(data.scanned_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </PageHeader>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {/* Heading */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 700, margin: "0 0 2px", lineHeight: 1, textTransform: "capitalize", transform: "rotate(-0.3deg)" }}>
            {decodedName} breakdown
          </h1>
          <svg width="60%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block" }}>
            <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* KPI pills */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "var(--gap)" }}>
          {[
            { val: `${data.visibility_pct}%`, label: "visibility", bg: "#FFF9DB", acc: "var(--primary)" },
            { val: `${data.times_mentioned}/${data.total_queries}`, label: "mentioned", bg: "#DBEAFF", acc: "#3B82F6" },
            { val: data.avg_position ? `#${data.avg_position}` : "-", label: "avg position", bg: "#E6F9ED", acc: "#22C55E" },
            { val: data.avg_score, label: "avg score", bg: "#F3E8FF", acc: "#A855F7" },
          ].map((s, i) => (
            <div key={s.label} style={{ background: s.bg, border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "10px 16px", transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.acc }}>{s.val}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Query results */}
        <div className="section-label" style={{ marginBottom: 10 }}>Per-query results</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.queries.map((q, i) => (
            <div key={q.query_id} className="card" style={{ padding: "12px 16px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderTop: q.mentioned ? "3px solid var(--primary)" : "3px solid var(--bg-dark)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.query_text}
                </Link>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  <PositionPill position={q.mentioned ? q.position : null} />
                  <SentimentPill sentiment={q.sentiment as any} />
                  {q.score != null && q.score > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 800, color: q.score >= 70 ? "#166534" : q.score >= 40 ? "var(--text)" : "#991B1B" }}>{q.score}</span>
                  )}
                </div>
              </div>
              {q.competitors_mentioned.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {q.competitors_mentioned.map((c) => (
                    <span key={c.name} className="pill pill-neu" style={{ fontSize: 10 }}>#{c.position} {c.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
