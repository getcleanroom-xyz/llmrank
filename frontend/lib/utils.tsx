/** Shared utility functions used across the dashboard. */

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date.endsWith("Z") ? date : date + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const SENTIMENT_LABELS: Record<string, string> = {
  positive: "Positive", neutral: "Neutral", negative: "Negative", not_mentioned: "Unmentioned",
};

export const LLM_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", llama: "Llama",
  deepseek: "DeepSeek", mistral: "Mistral", qwen: "Qwen",
};

export const LLM_COLORS: Record<string, string> = {
  chatgpt: "#22C55E", gemini: "#3B82F6", llama: "#A855F7", claude: "#F97316",
  deepseek: "#22C55E", mistral: "#3B82F6", qwen: "#A855F7",
};

export function PositionBadge({ mentioned, position }: { mentioned: boolean; position: number | null }) {
  if (!mentioned) return <span className="pill pill-neg" style={{ fontSize: 9 }}>&ndash;</span>;
  if (position == null) return <span className="pill pill-neu" style={{ fontSize: 9 }}>?</span>;
  const cls = position <= 2 ? "pill pill-pos" : position <= 4 ? "pill pill-neu" : "pill pill-neg";
  return <span className={cls} style={{ fontSize: 9 }}>#{position}</span>;
}
