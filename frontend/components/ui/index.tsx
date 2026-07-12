"use client";

import type { Sentiment } from "@/types";

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/on\w+\s*=\s*[^\s>"']*/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "");
}

export function ScoreRing({ score, size = 80, stroke = 6 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circ - (clamped / 100) * circ;
  const color = clamped >= 70 ? "#22C55E" : clamped >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score: ${score}/100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E5E5" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} className="score-ring" />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={size / 3.5} fontWeight="700" fontFamily="var(--font-sans)">
        {Math.round(clamped)}
      </text>
    </svg>
  );
}

const LLM_COLORS: Record<string, string> = { chatgpt: "#22C55E", gemini: "#3B82F6", llama: "#A855F7", claude: "#F97316" };
const LLM_LABELS: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", llama: "Llama 3", claude: "Claude" };

export function LLMTag({ name }: { name: string }) {
  const color = LLM_COLORS[name] ?? "#888";
  const label = LLM_LABELS[name] ?? name;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, border: "1.5px solid var(--border)", flexShrink: 0 }} />
      {label}
    </span>
  );
}

export function getLLMColor(name: string) { return LLM_COLORS[name] ?? "#888"; }

export function SentimentPill({ sentiment }: { sentiment: Sentiment | string }) {
  const map: Record<string, { label: string; cls: string }> = {
    positive: { label: "Positive", cls: "pill pill-pos" },
    neutral: { label: "Neutral", cls: "pill pill-neu" },
    negative: { label: "Negative", cls: "pill pill-neg" },
    not_mentioned: { label: "Unmentioned", cls: "pill pill-neg" },
  };
  const { label, cls } = map[sentiment] ?? { label: sentiment, cls: "pill pill-neu" };
  return <span className={cls}>{label}</span>;
}

export function PositionPill({ position }: { position: number | null }) {
  if (position === null || position === undefined) return <span className="pill pill-neg">--</span>;
  const cls = position <= 2 ? "pill pill-pos" : position <= 4 ? "pill pill-neu" : "pill pill-neg";
  return <span className={cls}>#{position}</span>;
}

export function Bar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="bar-track" style={{ flex: 1 }}>
      <div className="bar-fill" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

export function KpiCard({ label, value, sub, subColor }: { label: string; value: string | number; sub?: React.ReactNode; subColor?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div className="section-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 6, color: subColor ?? "var(--text-muted)", fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

export function InsightRow({ type, text }: { type: "tip" | "warning"; text: string }) {
  const isTip = type === "tip";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1.5px solid var(--border)" }}>
      <div style={{ width: 24, height: 24, borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, background: isTip ? "var(--green)" : "var(--orange)", color: "white", fontSize: 12, fontWeight: 700, border: "1.5px solid var(--border)" }}>
        {isTip ? "+" : "!"}
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />
    </div>
  );
}
