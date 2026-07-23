"use client";

import type { Sentiment } from "@/types";

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/on\w+\s*=\s*[^\s>"']*/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/style\s*=\s*"[^"]*expression\s*\([^"]*"/gi, "")
    .replace(/style\s*=\s*'[^']*expression\s*\([^']*'/gi, "")
    .replace(/style\s*=\s*[^\s>"']*expression\s*\([^\s>"']*/gi, "");
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

const LLM_COLORS: Record<string, string> = { chatgpt: "#22C55E", gpt4o: "#10B981", gemini: "#3B82F6", llama: "#A855F7", "llama-small": "#7C3AED", claude: "#F97316", deepseek: "#EF4444", "deepseek-r1": "#DC2626", mistral: "#6366F1", qwen: "#EC4899" };
const LLM_LABELS: Record<string, string> = { chatgpt: "GPT-4o Mini", gpt4o: "GPT-4o", gemini: "Gemini", llama: "Llama 3.3", "llama-small": "Llama 3.1", claude: "Claude", deepseek: "DeepSeek", "deepseek-r1": "DeepSeek R1", mistral: "Mistral", qwen: "Qwen" };

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
