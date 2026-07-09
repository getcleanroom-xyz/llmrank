"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCompetitorDrilldown } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";

export default function CompetitorDrilldownPage() {
  const { brandId, competitorName } = useParams<{ brandId: string; competitorName: string }>();
  const decodedName = decodeURIComponent(competitorName);
  const { data, isLoading, error } = useCompetitorDrilldown(brandId, competitorName);

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
            <span style={{ fontSize: 13, fontWeight: 600 }}>{decodedName}</span>
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
          <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 700, margin: "0 0 2px", lineHeight: 1, transform: "rotate(-0.3deg)" }}>
            {decodedName}
          </h1>
          <svg width="60%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block" }}>
            <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* KPI pills */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "var(--gap)" }}>
          {[
            { val: `${data.mention_pct}%`, label: "mention rate", bg: "#FEE2E2", acc: "#991B1B" },
            { val: `${data.total_appearances}/${data.total_queries}`, label: "appearances", bg: "#DBEAFF", acc: "#3B82F6" },
            { val: data.beats_brand_count, label: "beats your brand", bg: "#FEE2E2", acc: "#991B1B" },
          ].map((s, i) => (
            <div key={s.label} style={{ background: s.bg, border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "10px 16px", transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.acc }}>{s.val}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="card" style={{ padding: "14px 16px", marginBottom: "var(--gap)", background: "#FEE2E2", borderColor: "#991B1B", transform: "rotate(-0.2deg)" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            <strong>{decodedName}</strong> appears in <strong>{data.mention_pct}%</strong> of all monitored results and outranks you in <strong>{data.beats_brand_count}</strong> of those.
            A comparison page targeting <strong>{decodedName}</strong> could help reclaim visibility where they&apos;re beating you.
          </p>
        </div>

        {/* Where they show up */}
        <div className="section-label" style={{ marginBottom: 10 }}>Where they show up</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.queries.map((q, i) => (
            <div key={`${q.query_id}-${q.llm_name}`} className="card" style={{ padding: "12px 16px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: q.competitor_position <= q.brand_position! ? "4px solid #991B1B" : "4px solid var(--bg-dark)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.query_text}
                </Link>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "capitalize", flexShrink: 0 }}>{q.llm_name}</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>
                  <span style={{ color: "#991B1B" }}>{decodedName}</span> at #{q.competitor_position}
                </span>
                {q.brand_mentioned ? (
                  <span style={{ color: "var(--text-secondary)" }}>
                    You at #{q.brand_position}
                    {q.competitor_position < (q.brand_position ?? 999) && <span style={{ marginLeft: 4, color: "#991B1B", fontWeight: 700 }}>→ beating you</span>}
                    {(q.brand_position ?? 999) < q.competitor_position && <span style={{ marginLeft: 4, color: "#166534", fontWeight: 700 }}>→ you win</span>}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>You not mentioned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
