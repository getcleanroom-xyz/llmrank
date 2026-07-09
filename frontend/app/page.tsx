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
        {/* Hero */}
        <header style={{ paddingTop: "clamp(40px, 10vh, 80px)", paddingBottom: 32 }}>
          <h1
            style={{
              fontSize: "clamp(28px, 6vw, 48px)",
              fontWeight: 800,
              color: "var(--text)",
              margin: "0 0 12px",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            Know what<br />
            <span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)", display: "inline-block" }}>
              AI tells people
            </span>
            <br />
            about your brand
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              margin: "0 0 20px",
              lineHeight: 1.6,
              maxWidth: 540,
            }}
          >
            Every day, people ask ChatGPT and other AI models about products like yours.
            Do you know what the AI is telling them? LLMRank shows you exactly how AI models rank your brand, and how to rank better.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <LandingCTA variant="primary" />
            <LandingCTA variant="secondary" />
          </div>
        </header>

        {/* Supported LLMs */}
        <section style={{ paddingBottom: 24, borderBottom: "2px solid var(--border)", marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>AI Models We Monitor</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUPPORTED_LLMS.map((llm) => (
              <span key={llm} className="pill pill-neu">
                {llm}
              </span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" style={{ paddingBottom: 32 }}>
          <h2 className="section-label" style={{ marginBottom: 12 }}>How It Works</h2>
          <div className="grid-3">
            {STEPS.map((item) => (
              <div key={item.step} className="card">
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)", marginBottom: 8 }}>
                  {item.step}
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
        <section style={{ paddingBottom: 32 }}>
          <h2 className="section-label" style={{ marginBottom: 12 }}>What You Get</h2>
          <div className="grid-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{feature.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {feature.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ - AEO optimized */}
        <section style={{ paddingBottom: 32 }}>
          <h2 className="section-label" style={{ marginBottom: 12 }}>Common Questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <details key={i} className="card" style={{ padding: "12px 16px", cursor: "pointer" }}>
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

        {/* Bottom CTA */}
        <section style={{ paddingBottom: 40 }}>
          <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Start tracking your AI visibility
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginBottom: 16,
                maxWidth: 400,
                margin: "0 auto 16px",
              }}
            >
              Free to start. No credit card. Takes under a minute to set up. Stop guessing what AI says about your brand and start knowing.
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
