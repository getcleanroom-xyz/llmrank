import { LandingHeader, LandingCTA } from "@/components/landing/LandingHeader";

const SUPPORTED_LLMS = ["ChatGPT", "Gemini", "Claude", "Llama", "DeepSeek", "Mistral", "Qwen"];

const HOW_IT_WORKS = [
  { step: "1", title: "Add your brand", desc: "Put your brand name and domain. That's all." },
  { step: "2", title: "We fire the queries", desc: "Ask ChatGPT, Gemini, Claude and others the questions your customers dey ask." },
  { step: "3", title: "See your ranking", desc: "See exactly how each AI model dey rank you. Who dey mention you? Where you dey appear?" },
];

const FEATURES = [
  { title: "Visibility Score", desc: "One number wey tell you how visible you be across all AI models." },
  { title: "LLM Breakdown", desc: "See how each AI model dey see you separately." },
  { title: "Competitor Share", desc: "See who dey steal your spotlight." },
  { title: "Per-Query Drilldown", desc: "Click any question see the exact response each AI give." },
  { title: "AI Suggestions", desc: "We go suggest the right questions to track." },
  { title: "Actionable Insights", desc: "We go tell you wetin to do based on your actual gaps." },
];

export default function HomePage() {
  return (
    <main className="page" style={{ display: "flex", flexDirection: "column" }}>
      <LandingHeader />

      <div style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "0 var(--page-px)", width: "100%" }}>
        <header style={{ paddingTop: "clamp(40px, 10vh, 80px)", paddingBottom: 32 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>AI SEO Visibility Tracking</div>
          <h1 style={{ fontSize: "clamp(28px, 6vw, 48px)", fontWeight: 800, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
            How dem see your brand
            <br />
            for inside <span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)", display: "inline-block" }}>ChatGPT?</span>
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.6, maxWidth: 540 }}>
            You know say people dey ask ChatGPT, Gemini, Claude about your product every day?
            But you no know wetin dem dey hear. LLMRank show you exactly how AI models dey rank your brand — and how to rank better.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <LandingCTA variant="primary" />
            <LandingCTA variant="secondary" />
          </div>
          <button data-auth-trigger className="hidden" />
        </header>

        <section style={{ paddingBottom: 24, borderBottom: "2px solid var(--border)", marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Supported LLMs</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUPPORTED_LLMS.map((llm) => (
              <span key={llm} className="pill pill-neu">{llm}</span>
            ))}
          </div>
        </section>

        <section id="how-it-works" style={{ paddingBottom: 32 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>How e dey work?</div>
          <div className="grid-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="card">
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)", marginBottom: 8 }}>{item.step}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ paddingBottom: 32 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Wetin you go see inside?</div>
          <div className="grid-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{feature.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{feature.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ paddingBottom: 40, textAlign: "center" }}>
          <div className="card" style={{ padding: "32px 24px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Make AI dey talk about you
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, maxWidth: 400, margin: "0 auto 16px" }}>
              Join the people wey don dey track their AI visibility. Free to start. No credit card. No wahala.
            </p>
            <LandingCTA variant="primary" />
          </div>
        </section>
      </div>

      <footer style={{ padding: "16px var(--page-px)", borderTop: "2px solid var(--border)", marginTop: "auto", fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>
        llm<span style={{ color: "var(--primary)" }}>rank</span> — AI SEO visibility tracking
      </footer>
    </main>
  );
}
