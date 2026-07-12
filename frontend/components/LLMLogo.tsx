"use client";

const LLM_COLORS: Record<string, string> = {
  chatgpt: "#22C55E", gpt4o: "#22C55E",
  gemini: "#3B82F6",
  claude: "#F97316",
  llama: "#A855F7", "llama-small": "#A855F7",
  deepseek: "#0EA5E9", "deepseek-r1": "#0EA5E9",
  mistral: "#EF4444",
  qwen: "#6366F1",
};

function ChatGPTLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor"/>
    </svg>
  );
}

function GeminiLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 24C12 20.2 10.1 17 7 15.5C4.4 14.2 2.5 14.5 2.5 14.5C2.5 14.5 5.5 11.5 9.5 10C12.3 8.9 12 2 12 2C12 2 11.7 8.9 14.5 10C18.5 11.5 21.5 14.5 21.5 14.5C21.5 14.5 19.6 14.2 17 15.5C13.9 17 12 20.2 12 24Z" fill="currentColor"/>
    </svg>
  );
}

function ClaudeLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.709 15.955l4.397-10.985c.2-.499.349-.873.549-.873.2 0 .349.374.549.873l4.397 10.985h-2.02l-1.003-2.645H7.732l-1.003 2.645H4.709zm3.623-4.504h3.312L10.5 6.552h-.044L8.332 11.451z" fill="currentColor"/>
      <path d="M15.291 15.955l4.397-10.985c.2-.499.349-.873.549-.873.2 0 .349.374.549.873l4.397 10.985h-2.02l-1.003-2.645h-3.476l-1.003 2.645h-2.02zm3.623-4.504h3.312L21.001 6.552h-.044l-1.948 4.899z" fill="currentColor"/>
    </svg>
  );
}

function LlamaLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 16c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="9.5" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="14.5" cy="10" r="1.5" fill="currentColor"/>
      <path d="M12 2v2M12 20v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DeepSeekLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 12c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="14" r="1" fill="currentColor"/>
    </svg>
  );
}

function MistralLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 17l4-6 4 6H3z" fill="currentColor"/>
      <path d="M10 17l4-6 4 6h-4z" fill="currentColor" opacity="0.6"/>
      <path d="M17 17l3-5 3 5h-3z" fill="currentColor" opacity="0.3"/>
    </svg>
  );
}

function QwenLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 12h4l2-4 2 8 2-4h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const LOGO_MAP: Record<string, React.FC<{ size: number }>> = {
  chatgpt: ChatGPTLogo, gpt4o: ChatGPTLogo,
  gemini: GeminiLogo,
  claude: ClaudeLogo,
  llama: LlamaLogo, "llama-small": LlamaLogo,
  deepseek: DeepSeekLogo, "deepseek-r1": DeepSeekLogo,
  mistral: MistralLogo,
  qwen: QwenLogo,
};

export function LLMLogo({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const key = name.toLowerCase();
  const Logo = LOGO_MAP[key];
  const color = LLM_COLORS[key] ?? "#888";

  if (Logo) {
    return (
      <div
        className={className}
        style={{
          width: size, height: size, borderRadius: "50%",
          background: color, display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#fff", border: "2px solid var(--border)",
          boxShadow: "var(--shadow-sm)", flexShrink: 0,
        }}
      >
        <Logo size={size * 0.55} />
      </div>
    );
  }

  // Fallback: just colored circle
  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color, border: "2px solid var(--border)",
        boxShadow: "var(--shadow-sm)", flexShrink: 0,
      }}
    />
  );
}
