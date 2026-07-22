"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useLLMDrilldown } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { PositionPill, SentimentPill, getLLMColor } from "@/components/ui";
import { LLMLogo } from "@/components/LLMLogo";

const LLM_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT", gpt4o: "GPT-4o", gemini: "Gemini", llama: "Llama 3.3",
  "llama-small": "Llama 3.1", claude: "Claude", deepseek: "DeepSeek",
  "deepseek-r1": "DeepSeek R1", mistral: "Mistral", qwen: "Qwen",
};

function displayName(name: string) { return LLM_NAMES[name.toLowerCase()] ?? name; }

function computeSentiment(queries: { sentiment: string }[]) {
  const counts = { positive: 0, negative: 0, neutral: 0 };
  for (const q of queries) {
    const s = (q.sentiment || "neutral").toLowerCase() as keyof typeof counts;
    if (s in counts) counts[s]++;
  }
  const total = queries.length;
  if (counts.positive / total > 0.6) return { label: "Mostly positive", color: "#166534", bg: "#DCFCE7" };
  if (counts.negative / total > 0.6) return { label: "Mostly negative", color: "#991B1B", bg: "#FEE2E2" };
  if (counts.positive > 0 && counts.negative > 0) return { label: "Mixed", color: "#92400E", bg: "#FEF3C7" };
  if (counts.positive > counts.negative && counts.positive > 0) return { label: "Leaning positive", color: "#166534", bg: "#DCFCE7" };
  if (counts.negative > counts.positive && counts.negative > 0) return { label: "Leaning negative", color: "#991B1B", bg: "#FEE2E2" };
  return { label: "Neutral", color: "var(--text-secondary)", bg: "#F3F4F6" };
}

function topCompetitors(queries: { competitors_mentioned: { name: string }[] }[]) {
  const counts: Record<string, number> = {};
  for (const q of queries) for (const c of q.competitors_mentioned) counts[c.name] = (counts[c.name] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function StatCard({ value, label, bg, accent }: { value: string; label: string; bg: string; accent: string }) {
  return (
    <div style={{ background: bg, border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "10px 14px", display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: accent }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function QueryCard({ q, brandId, variant }: { q: { query_id: string; query_text: string; position: number | null; sentiment: string; score: number | null; competitors_mentioned: { name: string; position: number | null }[] }; brandId: string; variant: "mentioned" | "absent" }) {
  const borderLeft = variant === "mentioned" ? "4px solid var(--primary)" : "4px solid var(--bg-dark)";
  return (
    <div className="card" style={{ padding: "12px 16px", borderLeft }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <Link href={`/brands/${brandId}/queries/${q.query_id}`} style={{ fontSize: 13, fontWeight: variant === "mentioned" ? 700 : 600, color: variant === "mentioned" ? "var(--text)" : "var(--text-muted)", textDecoration: "none", lineHeight: 1.5, flex: 1 }}>
          {q.query_text}
        </Link>
        {variant === "mentioned" ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <PositionPill position={q.position} />
            <SentimentPill sentiment={q.sentiment as any} />
            {q.score != null && q.score > 0 && (
              <span style={{ fontSize: 13, fontWeight: 800, color: q.score >= 70 ? "#166534" : q.score >= 40 ? "var(--text)" : "#991B1B" }}>{q.score}</span>
            )}
          </div>
        ) : (
          <span className="pill pill-neg" style={{ fontSize: 10, flexShrink: 0 }}>not mentioned</span>
        )}
      </div>
      {variant === "mentioned" && q.competitors_mentioned.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {q.competitors_mentioned.map((c) => (
            <Link key={c.name} href={`/brands/${brandId}/competitors/${encodeURIComponent(encodeURIComponent(c.name))}`} style={{ textDecoration: "none" }}>
              <span className="pill pill-neu" style={{ fontSize: 10, cursor: "pointer" }}>{c.position != null ? `#${c.position} ` : ""}{c.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LLMDrilldownPage() {
  const { brandId, llmName } = useParams<{ brandId: string; llmName: string }>();
  const decodedName = decodeURIComponent(llmName);
  const name = displayName(decodedName);
  const { data, isLoading, error } = useLLMDrilldown(brandId, decodedName);

  if (isLoading) return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)", padding: "10px 16px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div className="skeleton" style={{ width: 80, height: 20 }} />
          <div className="skeleton" style={{ width: 100, height: 14 }} />
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="skeleton" style={{ width: "30%", height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: "50%", height: 12 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="card" style={{ padding: 14 }}><div className="skeleton" style={{ width: "40%", height: 20, marginBottom: 4 }} /><div className="skeleton" style={{ width: "60%", height: 10 }} /></div>)}
        </div>
      </div>
    </div>
  );
  if (error || !data) return (
    <div className="page" style={{ padding: "var(--page-px)" }}>
      <AppHeader breadcrumb={<Link href={`/brands/${brandId}`} style={{ fontWeight: 600, color: "var(--text-muted)", textDecoration: "none", fontSize: 13 }}>dashboard</Link>} />
      <div style={{ color: "var(--red)", fontWeight: 700 }}>{error instanceof Error ? error.message : "No data"}</div>
    </div>
  );

  const mentioned = data.queries.filter((q) => q.mentioned);
  const notMentioned = data.queries.filter((q) => !q.mentioned);
  const color = getLLMColor(decodedName.toLowerCase());
  const scoresArr = mentioned.filter((q) => q.score != null).map((q) => q.score as number);
  const avgScore = scoresArr.length > 0 ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length) : null;
  const sentiment = mentioned.length > 0 ? computeSentiment(mentioned) : null;
  const competitors = topCompetitors(mentioned);

  const breadcrumb = (
    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>brands</Link>
      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
      <Link href={`/brands/${brandId}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>dashboard</Link>
      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>/</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
    </div>
  );

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader breadcrumb={breadcrumb} />
      <PageHeader>
        <Link href={`/brands/${brandId}`} className="btn btn-sm btn-ghost btn-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
          {new Date(data.scanned_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>

        {/* Empty state */}
        {data.queries.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <LLMLogo name={decodedName} size={40} />
            <p style={{ fontSize: 15, fontWeight: 600, margin: "16px 0 4px" }}>No data for this model yet</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>Run a scan to see how {name} responds about your brand.</p>
            <Link href={`/brands/${brandId}`} className="btn btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
              Go to dashboard <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          </div>
        )}

        {data.queries.length > 0 && (
          <>
            {/* Hero */}
            <div className="card sketchy" style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: "24px 28px", marginBottom: "var(--gap)", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", transform: "rotate(-0.2deg)" }}>
              <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, left: 24, zIndex: 2 }}>
                <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
                <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
              </svg>
              <LLMLogo name={decodedName} size={48} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, margin: "0 0 2px", lineHeight: 1 }}>{name}</h1>
                <svg width="60%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", marginBottom: 6 }}>
                  <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, fontFamily: "var(--font-serif), Georgia, serif" }}>
                  Mentioned your brand in <strong>{data.times_mentioned}</strong> of <strong>{data.total_queries}</strong> queries ({data.visibility_pct}% visibility).
                  {data.avg_position && <> Average position: <strong>#{data.avg_position}</strong>.</>}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: "var(--gap)" }}>
              <StatCard value={`${data.visibility_pct}%`} label="visibility" bg="#FFF9DB" accent="var(--primary)" />
              <StatCard value={`${data.times_mentioned}/${data.total_queries}`} label="mentioned" bg="#DBEAFF" accent="#3B82F6" />
              <StatCard value={data.avg_position ? `#${data.avg_position}` : "-"} label="avg position" bg="#E6F9ED" accent="#22C55E" />
              <StatCard value={avgScore != null ? `${avgScore}` : "-"} label="avg score" bg="#F3E8FF" accent="#A855F7" />
            </div>

            {/* Insights — single card */}
            {(sentiment || competitors.length > 0) && (
              <div className="card" style={{ padding: "12px 16px", marginBottom: "var(--gap)", display: "flex", flexDirection: "column", gap: 8 }}>
                {sentiment && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", flexShrink: 0 }}>Sentiment</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sentiment.color, background: sentiment.bg, padding: "2px 8px", borderRadius: 6 }}>{sentiment.label}</span>
                  </div>
                )}
                {competitors.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", flexShrink: 0 }}>Appears alongside</span>
                    {competitors.map(([cName, count]) => (
                      <Link key={cName} href={`/brands/${brandId}/competitors/${encodeURIComponent(cName)}`} style={{ textDecoration: "none" }}>
                        <span className="pill pill-neu" style={{ fontSize: 10, cursor: "pointer" }}>{cName} ({count})</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div style={{ textAlign: "center", margin: "4px 0 16px", opacity: 0.3 }}>
              <svg width="160" height="16" viewBox="0 0 160 16" fill="none">
                <path d="M5 8 Q15 3 30 8 Q45 13 60 8 Q75 3 90 8 Q105 13 120 8 Q135 3 155 8" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>

            {/* Mentioned */}
            {mentioned.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Mentioned ({mentioned.length})</div>
                  <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {mentioned.map((q) => <QueryCard key={q.query_id} q={q} brandId={brandId} variant="mentioned" />)}
                </div>
              </div>
            )}

            {/* Not mentioned */}
            {notMentioned.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Not mentioned ({notMentioned.length})</div>
                  <svg width="30" height="8" viewBox="0 0 30 8" fill="none"><path d="M0 4 Q5 1 10 5 Q15 7 20 3 Q25 1 30 5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
                  {name} didn&apos;t mention your brand in these queries. These are your visibility gaps for this model.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {notMentioned.map((q) => <QueryCard key={q.query_id} q={q} brandId={brandId} variant="absent" />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
