import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";

export const metadata: Metadata = {
  title: "Blog — LLMRank",
  description:
    "Notes on AI visibility, generative engine optimization, and how brands show up in ChatGPT, Gemini, and other AI models.",
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <LandingHeader />
      <div style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "0 var(--page-px)", width: "100%" }}>
        {children}
      </div>
      <footer
        style={{
          padding: "16px var(--page-px)",
          borderTop: "2px solid var(--border)",
          marginTop: "auto",
          fontSize: 12,
          color: "var(--text-muted)",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        llm<span style={{ color: "var(--primary)" }}>rank</span> &mdash; AI visibility tracking
      </footer>
    </div>
  );
}
