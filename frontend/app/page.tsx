import type { Metadata } from "next";
import { LandingHeader, LandingCTA } from "@/components/landing/LandingHeader";

export const dynamic = "force-static";

export const metadata: Metadata = {
  metadataBase: new URL("https://llmrank.getcleanroom.xyz"),
  title: "LLMRank — Track How AI Models Rank Your Brand",
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
    title: "LLMRank — Track How AI Models Rank Your Brand",
    description:
      "See exactly how your brand appears in ChatGPT, Gemini, Claude, and more. Know what AI tells people about your company.",
    url: "https://llmrank.getcleanroom.xyz",
    siteName: "LLMRank",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLMRank — Track How AI Models Rank Your Brand",
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
    desc: "Enter your brand name and domain. Takes about 10 seconds.",
  },
  {
    step: "2",
    title: "We run the queries",
    desc: "We ask ChatGPT, Gemini, Claude, and others the actual questions your customers are searching for. Real queries, real answers.",
  },
  {
    step: "3",
    title: "See your ranking",
    desc: "Check which AI models mention you. Where do you rank? What sentiment? Who's your competition taking the top spots?",
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
    desc: "One number that tells you exactly how visible your brand is across every major AI model. Track it over time.",
  },
  {
    title: "Per-Model Breakdown",
    desc: "ChatGPT might love you while Claude ignores you. See the breakdown for each model so you know where to focus.",
  },
  {
    title: "Competitor Intelligence",
    desc: "See which competitors are getting mentioned ahead of you, how often, and in what context. Stop guessing.",
  },
  {
    title: "Per-Query Drilldown",
    desc: "Click any tracked question to see the exact AI response, word for word. Know what your customers are hearing about you.",
  },
  {
    title: "AI-Suggested Queries",
    desc: "Not sure what questions to track? We'll suggest the ones your market is actually asking the AIs.",
  },
  {
    title: "Actionable Insights",
    desc: "No fluff. We tell you exactly what to fix based on your gaps — publish a comparison page, add structured data, claim your profiles.",
  },
];

const FAQS = [
  {
    q: "How does LLMRank track my brand in AI models?",
    a: "We run your chosen queries — the same questions people ask ChatGPT, Gemini, and others — across multiple AI models on a schedule. Each response gets analyzed for whether your brand was mentioned, at what position, with what sentiment, and which competitors showed up instead. You get a dashboard with scores, trends, and specific recommendations.",
  },
  {
    q: "Which AI models do you monitor?",
    a: "Currently: ChatGPT (GPT-4o), Gemini, Claude, Llama (3.3 and smaller), DeepSeek, Mistral, and Qwen. We add new models as they gain adoption. If there's one you want that we don't cover yet, tell us — we're fast about adding them.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. You start with 500 free credits, which covers several full scans. No credit card needed. You only pay when you need more credits for higher-volume or premium-model monitoring.",
  },
  {
    q: "What's the difference between this and regular SEO?",
    a: "Regular SEO tools tell you where you rank on Google. But when someone asks ChatGPT 'what's the best project management tool,' Google rankings don't matter — the AI's training data and retrieval patterns do. LLMRank measures AI-native visibility, which is increasingly where buying decisions start.",
  },
  {
    q: "How do I improve my AI visibility?",
    a: "The playbook is different from traditional SEO. Structured data helps. Being mentioned in authoritative sources helps more. Comparison content and category-defining pages work well. We give you specific, ranked recommendations based on your actual gaps — not generic advice.",
  },
  {
    q: "Can I track my competitors too?",
    a: "Competitor tracking is built in. When you scan a query, we automatically detect competing brands mentioned in the AI responses and show you who's taking your spotlight and at what frequency. You don't need to configure anything.",
  },
];

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

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      <LandingHeader />

      <div style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "0 var(--page-px)", width: "100%" }}>

        {/* ── Hero ── */}
        <header style={{ paddingTop: "clamp(40px, 10vh, 80px)", paddingBottom: 36 }}>
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
              fontSize: "clamp(30px, 6vw, 50px)",
              fontWeight: 800,
              color: "var(--text)",
              margin: "0 0 8px",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            Know what{" "}
            <span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)", display: "inline-block" }}>
              AI tells people
            </span>{" "}
            about your brand
          </h1>

          <ScribbleUnderline color="var(--primary)" width="85%" style={{ marginBottom: 14 }} />

          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              margin: "0 0 22px",
              lineHeight: 1.6,
              maxWidth: 540,
              fontFamily: "var(--font-serif), Georgia, serif",
            }}
          >
            Every day, people ask ChatGPT and other AI models about products like yours. Do you know what the AI is telling them?
            LLMRank shows you exactly how AI models rank your brand &mdash; and how to rank better.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <LandingCTA variant="primary" />
            <LandingCTA variant="secondary" />
          </div>
        </header>

        {/* ── Supported LLMs ── */}
        <section style={{ paddingBottom: 24, borderBottom: "2px solid var(--border)", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>AI Models We Monitor</div>
            <svg width="40" height="10" viewBox="0 0 40 10" fill="none">
              <path d="M0 5 Q6 2 12 6 Q18 9 24 4 Q30 1 40 7" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
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

        {/* ── How it works ── */}
        <section id="how-it-works" style={{ paddingBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2 className="section-label" style={{ marginBottom: 0 }}>How It Works</h2>
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
                  transform: `rotate(${i === 0 ? "-0.5deg" : i === 1 ? "0.3deg" : "-0.3deg"})`,
                  padding: "18px 16px",
                }}
              >
                <PushPin />
                <div style={{ fontSize: "clamp(32px, 5vw, 40px)", fontFamily: "var(--font-hand), Caveat, cursive", fontWeight: 700, color: STEP_COLORS[i].accent, marginBottom: 4, marginTop: 4, lineHeight: 1 }}>
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

        {/* ── Features ── */}
        <section style={{ paddingBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2 className="section-label" style={{ marginBottom: 0 }}>What You Get</h2>
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

          {/* Scribble doodle between sections */}
          <div style={{ textAlign: "center", margin: "28px 0 8px", fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 18, color: "var(--text-muted)", opacity: 0.4 }}>
            ~ ~ ~
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ paddingBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2 className="section-label" style={{ marginBottom: 0 }}>Common Questions</h2>
            <svg width="40" height="10" viewBox="0 0 40 10" fill="none">
              <path d="M0 5 Q6 2 12 6 Q18 9 24 4 Q30 1 40 7" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <details key={i} className="card" style={{ padding: "12px 16px", cursor: "pointer", transform: `rotate(${i % 2 === 0 ? "-0.2deg" : "0.2deg"})` }}>
                <summary style={{ fontSize: 14, fontWeight: 700, marginBottom: 0 }}>
                  {faq.q}
                </summary>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 10 }}>
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ── */}
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
              Start tracking your AI visibility
            </h2>
            <ScribbleUnderline color="var(--primary)" width="180px" style={{ margin: "6px auto 12px" }} />
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
              Free to start. No credit card. Takes under a minute. Stop guessing what AI says about your brand and start knowing.
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
        llm<span style={{ color: "var(--primary)" }}>rank</span> &mdash; AI visibility tracking
      </footer>
    </main>
  );
}
