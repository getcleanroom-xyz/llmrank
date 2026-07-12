"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useLLMDrilldown } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { PositionPill, SentimentPill, getLLMColor, LLMTag } from "@/components/ui";
import { LLMLogo } from "@/components/LLMLogo";

const LLM_DISPLAY_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  claude: "Claude",
  llama: "Llama",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  qwen: "Qwen",
};

function llmDisplay(name: string): string {
  return LLM_DISPLAY_NAMES[name.toLowerCase()] ?? name;
}

export default function LLMDrilldownPage() {
  const { brandId, llmName } = useParams<{ brandId: string; llmName: string }>();
  const decodedName = decodeURIComponent(llmName);
  const displayName = llmDisplay(decodedName);
  const { data, isLoading, error } = useLLMDrilldown(brandId, decodedName);

  if (isLoading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>;
  if (error || !data) return (
    <div className="page" style={{ padding: "var(--page-px)" }}>
      <AppHeader breadcrumb={<Link href={`/brands/${brandId}`} style={{ fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>dashboard</Link>} />
      <div style={{ color: "var(--red)", fontWeight: 700 }}>{error instanceof Error ? error.message : "No data"}</div>
    </div>
  );

  const mentioned = data.queries.filter((q) => q.mentioned);
  const notMentioned = data.queries.filter((q) => !q.mentioned);
  const llmColor = getLLMColor(decodedName.toLowerCase());

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        breadcrumb={
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>brands</Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <Link href={`/brands/${brandId}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>dashboard</Link>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</span>
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

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {/* Hero card */}
        <div className="card sketchy" style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: "24px 28px", marginBottom: "var(--gap)", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", transform: "rotate(-0.2deg)" }}>
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, left: 24, zIndex: 2 }}>
            <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
            <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
          </svg>

          {/* LLM logo */}
          <LLMLogo name={decodedName} size={48} />

          <div style={{ flex: 1, minWidth: 180 }}>
            <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, margin: "0 0 2px", lineHeight: 1 }}>
              {displayName}
            </h1>
            <svg width="60%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", marginBottom: 6 }}>
              <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke={llmColor} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, fontFamily: "var(--font-serif), Georgia, serif" }}>
              Mentioned in <strong>{data.times_mentioned}</strong> of <strong>{data.total_queries}</strong> prompts ({data.visibility_pct}% visibility).
              {data.avg_position && <> Average position: <strong>#{data.avg_position}</strong>.</>}
            </p>
          </div>
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "var(--gap)" }}>
          {[
            { val: `${data.visibility_pct}%`, label: "visibility", bg: "#FFF9DB", acc: "var(--primary)" },
            { val: `${data.times_mentioned}/${data.total_queries}`, label: "mentioned", bg: "#DBEAFF", acc: "#3B82F6" },
            { val: data.avg_position ? `#${data.avg_position}` : "-", label: "avg position", bg: "#E6F9ED", acc: "#22C55E" },
            { val: data.avg_score, label: "avg score", bg: "#F3E8FF", acc: "#A855F7" },
          ].map((s, i) => (
            <div key={s.label} style={{ background: s.bg, border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "10px 16px", transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`, display: "flex", alignItems: "baseline", gap: 6, flex: "1 1 auto", maxWidth: 180 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: s.acc }}>{s.val}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Doodle divider */}
        <div style={{ textAlign: "center", margin: "10px 0 8px", opacity: 0.3 }}>
          <svg width="160" height="16" viewBox="0 0 160 16" fill="none">
            <path d="M5 8 Q15 3 30 8 Q45 13 60 8 Q75 3 90 8 Q105 13 120 8 Q135 3 155 8" stroke={llmColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        {/* Mentioned section */}
        {mentioned.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Mentioned ({mentioned.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none">
                <path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mentioned.map((q, i) => (
                <div key={q.query_id} className="card" style={{ padding: "12px 16px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, borderLeft: "4px solid var(--primary)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.query_text}
                    </Link>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <PositionPill position={q.position} />
                      <SentimentPill sentiment={q.sentiment as any} />
                      {q.score != null && q.score > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 800, color: q.score >= 70 ? "#166534" : q.score >= 40 ? "var(--text)" : "#991B1B" }}>{q.score}</span>
                      )}
                    </div>
                  </div>
                  {q.competitors_mentioned.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {q.competitors_mentioned.map((c) => (
                        <Link key={c.name} href={`/brands/${brandId}/competitors/${encodeURIComponent(c.name)}`} style={{ textDecoration: "none" }}>
                          <span className="pill pill-neu" style={{ fontSize: 10, cursor: "pointer" }}>{c.position != null ? `#${c.position} ` : ""}{c.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Not mentioned section */}
        {notMentioned.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Not mentioned ({notMentioned.length})</div>
              <svg width="30" height="8" viewBox="0 0 30 8" fill="none">
                <path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {notMentioned.map((q, i) => (
                <div key={q.query_id} className="card" style={{ padding: "12px 16px", transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})`, opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.query_text}
                    </Link>
                    <span className="pill pill-neg" style={{ fontSize: 10 }}>not mentioned</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.queries.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
            No prompt results for this model
          </div>
        )}
      </div>
    </div>
  );
}
