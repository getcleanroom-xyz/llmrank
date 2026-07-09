import type { Metadata } from "next";
import { LandingHeader, LandingCTA } from "@/components/landing/LandingHeader";
import { FlashcardStack } from "@/components/landing/FlashcardStack";

export const dynamic = "force-static";

export const metadata: Metadata = {
  metadataBase: new URL("https://llmrank.getcleanroom.xyz"),
  title: "LLMRank | Track How AI Models Rank Your Brand",
  description:
    "See exactly how your brand appears in ChatGPT, Gemini, Claude, and other AI models. Free visibility tracking, competitor monitoring, and actionable insights to rank higher in AI search results.",
  keywords: [
    "AI visibility tracking",
    "LLM brand monitoring",
    "ChatGPT SEO",
    "generative engine optimization",
    "AI answer engine tracking",
    "brand visibility in AI",
    "LLM ranking tool",
    "AI search optimization",
  ],
  openGraph: {
    title: "LLMRank | Track How AI Models Rank Your Brand",
    description:
      "See exactly how your brand appears in ChatGPT, Gemini, Claude, and more. Know what AI tells people about your company.",
    url: "https://llmrank.getcleanroom.xyz",
    siteName: "LLMRank",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLMRank | Track How AI Models Rank Your Brand",
    description:
      "See exactly how your brand appears in ChatGPT, Gemini, Claude, and more. Free to start.",
  },
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
  },
  alternates: {
    canonical: "https://llmrank.getcleanroom.xyz",
  },
};

const SUPPORTED_LLMS = ["ChatGPT", "Gemini", "Claude", "Llama", "DeepSeek", "Mistral", "Qwen"];

const STEPS = [
  {
    step: "1",
    title: "Add your brand",
    desc: "Name and domain. Ten seconds.",
  },
  {
    step: "2",
    title: "We run the queries",
    desc: "The actual questions people ask AI about your category. Real queries, real answers.",
  },
  {
    step: "3",
    title: "See your ranking",
    desc: "Which models mention you. Where. With what sentiment. Who's beating you.",
  },
];

const STEP_COLORS = [
  { bg: "#FFF9DB", accent: "var(--primary)" },
  { bg: "#DBEAFF", accent: "#3B82F6" },
  { bg: "#E6F9ED", accent: "#22C55E" },
];

const FEATURES = [
  {
    title: "Visibility Score",
    desc: "One number. All models. Track it over time.",
  },
  {
    title: "Per-Model Breakdown",
    desc: "ChatGPT might love you while Claude ignores you. Know the difference.",
  },
  {
    title: "Competitor Intelligence",
    desc: "Who's getting mentioned instead of you. How often. In what context.",
  },
  {
    title: "Per-Query Drilldown",
    desc: "Click any query. Read the exact AI response. Word for word.",
  },
  {
    title: "AI-Suggested Queries",
    desc: "Not sure what to track? We'll tell you what your market is asking.",
  },
  {
    title: "Actionable Fixes",
    desc: "Publish a comparison page. Add structured data. Claim your profiles. We tell you exactly what to do.",
  },
];

const Q_AND_A = [
  {
    q: "How do I know if I'm even showing up in AI?",
    a: "Run a scan. Pick a few questions your customers actually ask, and we'll check every major AI model for whether you're mentioned, where, with what sentiment. You'll know in minutes.",
  },
  {
    q: "Which models do you check?",
    a: "ChatGPT (GPT-4o), Gemini, Claude, Llama 3.3, DeepSeek, Mistral, Qwen. We add new ones as they get traction.",
  },
  {
    q: "Is there a free plan?",
    a: "500 free credits when you sign up. That covers several full scans. No card needed. Pay only if you need more.",
  },
  {
    q: "How is this different from SEO tools?",
    a: "SEO tools track Google. This tracks AI models. Different thing. When someone asks ChatGPT for recommendations, your Google rank doesn't come up. Your training data presence does.",
  },
  {
    q: "What can I actually do to improve my AI visibility?",
    a: "Structured data on your site. Getting mentioned in the sources AI trains on. Publishing comparison pages. We'll tell you exactly what to do based on your gaps.",
  },
  {
    q: "Can I see what my competitors are doing?",
    a: "Built in. Every scan auto-detects competing brands in the AI responses. You'll know who's getting mentioned instead of you and how often.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: Q_AND_A.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LLMRank",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Track how your brand appears in ChatGPT, Gemini, Claude, and other AI models. Visibility scores, competitor intelligence, and actionable insights.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

function ScribbleUnderline({ color = "var(--primary)", width = "100%", style }: { color?: string; width?: string; style?: React.CSSProperties }) {
  return (
    <svg width={width} height="8" viewBox="0 0 120 8" preserveAspectRatio="none" style={{ display: "block", ...style }}>
      <path
        d="M0 4 Q10 0 20 5 Q30 8 40 3 Q50 0 60 6 Q70 8 80 2 Q90 0 100 5 Q110 8 120 3"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PushPin() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
      <ellipse cx="9" cy="4.5" rx="4.5" ry="4.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
      <rect x="7" y="9" width="4" height="7" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="page" style={{ display: "flex", flexDirection: "column" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <LandingHeader />

      <div style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "0 var(--page-px)", width: "100%" }}>

        {/* Hero */}
        <header style={{ paddingTop: "clamp(44px, 10vh, 80px)", paddingBottom: 40 }}>
          <div
            style={{
              fontFamily: "var(--font-hand), Caveat, cursive",
              fontSize: "clamp(18px, 3vw, 24px)",
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 4,
              transform: "rotate(-0.5deg)",
            }}
          >
            AI visibility tracking, finally simple
          </div>

          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 52px)",
              fontWeight: 800,
              color: "var(--text)",
              margin: "0 0 8px",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
          >
            What does{" "}
            <span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)", display: "inline-block" }}>
              ChatGPT
            </span>{" "}
            say<br />about your brand?
          </h1>

          <ScribbleUnderline color="var(--primary)" width="75%" style={{ marginBottom: 16 }} />

          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              margin: "0 0 24px",
              lineHeight: 1.6,
              maxWidth: 500,
              fontFamily: "var(--font-serif), Georgia, serif",
            }}
          >
            Your customers are asking AI models about products like yours every day.
            If you don&apos;t know what the AI is telling them, you&apos;re flying blind.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <LandingCTA variant="primary" />
            <LandingCTA variant="secondary" />
          </div>
        </header>

        {/* Supported LLMs */}
        <section style={{ paddingBottom: 24, borderBottom: "2px solid var(--border)", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>We monitor</div>
            <svg width="30" height="10" viewBox="0 0 30 10" fill="none">
              <path d="M0 5 Q5 2 10 6 Q15 9 20 4 Q25 1 30 7" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUPPORTED_LLMS.map((llm) => (
              <span key={llm} className="pill pill-neu">
                {llm}
              </span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" style={{ paddingBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2
              style={{
                fontFamily: "var(--font-hand), Caveat, cursive",
                fontSize: "clamp(24px, 3.5vw, 30px)",
                fontWeight: 700,
                margin: 0,
                lineHeight: 1,
                transform: "rotate(-0.4deg)",
              }}
            >
              How it works
            </h2>
            <svg width="40" height="10" viewBox="0 0 40 10" fill="none">
              <path d="M0 5 Q6 2 12 6 Q18 9 24 4 Q30 1 40 7" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="grid-3">
            {STEPS.map((item, i) => (
              <div
                key={item.step}
                className="card"
                style={{
                  background: STEP_COLORS[i].bg,
                  position: "relative",
                  transform: `rotate(${i === 0 ? "-0.6deg" : i === 1 ? "0.4deg" : "-0.4deg"})`,
                  padding: "18px 16px",
                }}
              >
                <PushPin />
                <div
                  style={{
                    fontSize: "clamp(32px, 5vw, 40px)",
                    fontFamily: "var(--font-hand), Caveat, cursive",
                    fontWeight: 700,
                    color: STEP_COLORS[i].accent,
                    marginBottom: 4,
                    marginTop: 4,
                    lineHeight: 1,
                  }}
                >
                  {item.step}.
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section style={{ paddingBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2
              style={{
                fontFamily: "var(--font-hand), Caveat, cursive",
                fontSize: "clamp(24px, 3.5vw, 30px)",
                fontWeight: 700,
                margin: 0,
                lineHeight: 1,
                transform: "rotate(-0.3deg)",
              }}
            >
              What you get
            </h2>
            <svg width="40" height="10" viewBox="0 0 40 10" fill="none">
              <path d="M0 5 Q6 2 12 6 Q18 9 24 4 Q30 1 40 7" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="grid-2">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className="card"
                style={{
                  padding: 14,
                  transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{feature.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {feature.desc}
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", margin: "28px 0 8px", fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 18, color: "var(--text-muted)", opacity: 0.35 }}>
            ~ ~ ~
          </div>
        </section>

        {/* Q&A - Flashcard stack */}
        <FlashcardStack items={Q_AND_A} />

        {/* Bottom CTA */}
        <section style={{ paddingBottom: 48 }}>
          <div
            style={{
              position: "relative",
              background: "#FFF9DB",
              border: "2px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "4px 4px 0 #1A1A1A",
              padding: "28px 24px",
              textAlign: "center",
              transform: "rotate(0.3deg)",
            }}
          >
            <PushPin />
            <h2
              style={{
                fontFamily: "var(--font-hand), Caveat, cursive",
                fontSize: "clamp(28px, 4.5vw, 38px)",
                fontWeight: 700,
                margin: "0 0 4px",
                lineHeight: 1.1,
              }}
            >
              Ready to find out?
            </h2>
            <ScribbleUnderline color="var(--primary)" width="140px" style={{ margin: "6px auto 12px" }} />
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginBottom: 16,
                maxWidth: 400,
                margin: "0 auto 18px",
                fontFamily: "var(--font-serif), Georgia, serif",
              }}
            >
              Free. No credit card. Takes under a minute.
            </p>
            <LandingCTA variant="primary" />
          </div>
        </section>
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
        <div style={{ marginBottom: 4 }}>
          <a href="/blog" style={{ color: "var(--text-muted)", textDecoration: "underline", fontWeight: 600 }}>
            Blog
          </a>
        </div>
        llm<span style={{ color: "var(--primary)" }}>rank</span> · AI visibility tracking
      </footer>
    </main>
  );
}
