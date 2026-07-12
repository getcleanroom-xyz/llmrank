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
  chatgpt: "ChatGPT", gpt4o: "GPT-4o", gemini: "Gemini", claude: "Claude",
  llama: "Llama 3.3", "llama-small": "Llama 3.1 8B",
  deepseek: "DeepSeek", "deepseek-r1": "DeepSeek R1",
  mistral: "Mistral", qwen: "Qwen",
};

export function PositionBadge({ mentioned, position }: { mentioned: boolean; position: number | null }) {
  if (!mentioned) return <span className="pill pill-neg" style={{ fontSize: 9 }}>&ndash;</span>;
  if (position == null) return <span className="pill pill-neu" style={{ fontSize: 9 }}>?</span>;
  const cls = position <= 2 ? "pill pill-pos" : position <= 4 ? "pill pill-neu" : "pill pill-neg";
  return <span className={cls} style={{ fontSize: 9 }}>#{position}</span>;
}
