import type { Metadata } from "next";
import { LandingHeader, LandingCTA } from "@/components/landing/LandingHeader";
import { FlashcardStack } from "@/components/landing/FlashcardStack";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  metadataBase: new URL("https://llmranked.org"),
  title: "LLMRanked | Track How AI Models Rank Your Brand",
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
    title: "LLMRanked | Track How AI Models Rank Your Brand",
    description:
      "See exactly how your brand appears in ChatGPT, Gemini, Claude, and more. Know what AI tells people about your company.",
    url: "https://llmranked.org",
    siteName: "LLMRanked",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/dashboard-screenshot.png",
        width: 1200,
        height: 630,
        alt: "LLMRanked dashboard showing GitHub's AI visibility score and competitor analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LLMRanked | Track How AI Models Rank Your Brand",
    description:
      "See exactly how your brand appears in ChatGPT, Gemini, Claude, and more. Free to start.",
    images: ["/images/dashboard-screenshot.png"],
  },
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
  },
  alternates: {
    canonical: "https://llmranked.org",
  },
};

const SUPPORTED_LLMS = ["ChatGPT", "GPT-4o", "Gemini", "Claude", "Llama", "DeepSeek", "Mistral", "Qwen"];

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
    desc: "One number across all models. Track it over time.",
    color: "#FFF9DB",
    accent: "var(--primary)",
    image: "/images/feature-visibility.png",
    size: "large" as const,
  },
  {
    title: "Per-Model Breakdown",
    desc: "ChatGPT might love you while Claude ignores you. Know the difference.",
    color: "#DBEAFF",
    accent: "#3B82F6",
    image: "/images/feature-models.png",
    size: "medium" as const,
  },
  {
    title: "Competitor Intelligence",
    desc: "Threat levels, not just mentions. Know who's beating you and why.",
    color: "#FEE2E2",
    accent: "#991B1B",
    image: "/images/feature-competitors.png",
    size: "medium" as const,
  },
  {
    title: "Per-Query Drilldown",
    desc: "Click any query. Read the exact AI response. Word for word.",
    color: "#E6F9ED",
    accent: "#22C55E",
    image: "/images/feature-drilldown.png",
    size: "small" as const,
  },
  {
    title: "AI-Suggested Queries",
    desc: "Not sure what to track? We generate questions your market actually asks.",
    color: "#F3E8FF",
    accent: "#A855F7",
    image: "/images/feature-suggestions.png",
    size: "small" as const,
  },
  {
    title: "AI Copilot",
    desc: "Ask Lai anything. Get content plans, gap analysis, and competitor strategy on demand.",
    color: "#FFF9DB",
    accent: "var(--primary)",
    image: "/images/feature-copilot.png",
    size: "wide" as const,
  },
];

const PRICING_PLANS = [
  { name: "Free", credits: "500", price: "$0", note: "On signup", highlight: true },
  { name: "Starter", credits: "1,000", price: "$5", note: "~10 full scans" },
  { name: "Popular", credits: "5,000", price: "$20", note: "~50 full scans" },
  { name: "Pro", credits: "15,000", price: "$50", note: "~150 full scans" },
];

const Q_AND_A = [
  {
    q: "How do I know if I'm even showing up in AI?",
    a: "Run a scan. Pick a few questions your customers actually ask, and we'll check every major AI model for whether you're mentioned, where, with what sentiment. You'll know in minutes.",
  },
  {
    q: "Which models do you check?",
    a: "ChatGPT, GPT-4o, Gemini 3 Flash, Claude Sonnet 4.5, Llama 3.3, Llama 3.1, DeepSeek, DeepSeek R1, Mistral, and Qwen. We add new ones as they emerge.",
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
    desc: "We diagnose the root cause — whether it's a content gap, discoverability issue, lack of web mentions, or missing authority signals — then tell you exactly what to fix.",
    a: "We diagnose the root cause — whether it's a content gap, discoverability issue, lack of web mentions, or missing authority signals — then tell you exactly what to fix.",
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
  name: "LLMRanked",
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

function DashboardPreview() {
  return (
    <div style={{ position: "relative", marginBottom: 40, perspective: 1000 }}>
      {/* Decorative scribble behind */}
      <svg width="120" height="40" viewBox="0 0 120 40" fill="none" style={{ position: "absolute", top: -20, right: -10, zIndex: 0, opacity: 0.5 }}>
        <path d="M0 20 Q15 5 30 25 Q45 40 60 15 Q75 0 90 20 Q105 35 120 10" stroke="var(--primary)" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>

      {/* Main screenshot card */}
      <div
        style={{
          position: "relative",
          border: "3px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "8px 8px 0 #1A1A1A",
          transform: "rotate(-0.8deg)",
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        {/* Pushpin */}
        <PushPin />

        {/* Browser chrome */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "var(--bg-dark)", borderBottom: "2px solid var(--border)" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", border: "1.5px solid #1A1A1A" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FBBF24", border: "1.5px solid #1A1A1A" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", border: "1.5px solid #1A1A1A" }} />
          <div style={{ flex: 1, height: 18, borderRadius: 4, background: "var(--surface)", border: "1.5px solid var(--border)", marginLeft: 8, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
            llmranked.org/brands/github
          </div>
        </div>

        {/* Screenshot image */}
        <div style={{ position: "relative" }}>
          <img
            src="/images/dashboard-screenshot.png"
            alt="LLMRanked dashboard showing GitHub's AI visibility score of 59.3/100 with LLM breakdown and competitor share"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
          {/* Gradient overlay at bottom */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(transparent, var(--surface))" }} />
        </div>
      </div>

      {/* Floating annotation cards */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: -16,
          background: "#FFF9DB",
          border: "2px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "8px 12px",
          boxShadow: "3px 3px 0 #1A1A1A",
          transform: "rotate(2deg)",
          zIndex: 2,
          maxWidth: 140,
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>Visibility Score</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F59E0B", lineHeight: 1 }}>59.3</div>
        <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 12, color: "var(--text-secondary)" }}>/100 across 4 LLMs</div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 40,
          right: -12,
          background: "#E6F9ED",
          border: "2px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "8px 12px",
          boxShadow: "3px 3px 0 #1A1A1A",
          transform: "rotate(-1.5deg)",
          zIndex: 2,
          maxWidth: 130,
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>Competitor</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#991B1B", lineHeight: 1 }}>Travis CI</div>
        <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 11, color: "var(--text-secondary)" }}>beating you on 3 models</div>
      </div>
    </div>
  );
}

function PricingSection() {
  return (
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
          Simple pricing
        </h2>
        <svg width="40" height="10" viewBox="0 0 40 10" fill="none">
          <path d="M0 5 Q6 2 12 6 Q18 9 24 4 Q30 1 40 7" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {PRICING_PLANS.map((plan, i) => (
          <div
            key={plan.name}
            className="card sketchy"
            style={{
              padding: 14,
              textAlign: "center",
              transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`,
              border: plan.highlight ? "2px solid var(--primary)" : undefined,
              background: plan.highlight ? "#FFF9DB" : undefined,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{plan.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>{plan.price}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{plan.credits} credits</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{plan.note}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginTop: 8, textAlign: "center" }}>
        1 credit = $0.001 &middot; No subscriptions &middot; Pay as you go
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section style={{ paddingBottom: 36 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          textAlign: "center",
        }}
      >
        {[
          { value: "10", label: "AI models monitored" },
          { value: "500", label: "Free credits on signup" },
          { value: "<1min", label: "Time to first scan" },
        ].map((stat) => (
          <div key={stat.label} style={{ padding: "12px 8px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)", lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
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

        {/* Hero */}
        <header style={{ paddingTop: "clamp(44px, 10vh, 80px)", paddingBottom: 24 }}>
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
              AI
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
            Your customers are asking ChatGPT, Gemini, Claude, and other AI models about products like yours every day.
            If you don&apos;t know what the AI is telling them, you&apos;re flying blind.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <LandingCTA variant="primary" />
            <LandingCTA variant="secondary" />
          </div>
        </header>

        {/* Dashboard preview */}
        <DashboardPreview />

        {/* Social proof */}
        <SocialProof />

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
                className="card sketchy"
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

          {/* Magazine-style asymmetric grid */}
          <FeaturesGrid features={FEATURES} />

          <div style={{ textAlign: "center", margin: "28px 0 8px", fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 18, color: "var(--text-muted)", opacity: 0.35 }}>
            ~ ~ ~
          </div>
        </section>

        {/* Pricing */}
        <PricingSection />

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
          padding: "24px var(--page-px)",
          borderTop: "2px solid var(--border)",
          marginTop: "auto",
          fontSize: 12,
          color: "var(--text-muted)",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        <div
          className="card sketchy"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            marginBottom: 14,
            transform: "rotate(-0.5deg)",
            background: "#FFF9DB",
          }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ flexShrink: 0 }}>
            <ellipse cx="8" cy="4.5" rx="3.5" ry="3.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.2" />
            <rect x="6.5" y="8" width="3" height="6" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.2" />
          </svg>
          <span style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>Featured on</span>
          <a href="https://www.producthunt.com/products/llmrank?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-llmranked" target="_blank" rel="noopener noreferrer" style={{ display: "block", lineHeight: 0 }}>
            <img
              alt="LLMRanked - Know your brand's presence in AI-generated answers | Product Hunt"
              width={250}
              height={54}
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1202093&theme=neutral&t=1784614880945"
              style={{ display: "block" }}
            />
          </a>
        </div>

        <div style={{ marginBottom: 4 }}>
          <Link href="/blog" style={{ color: "var(--text-muted)", textDecoration: "underline", fontWeight: 600 }}>
            Blog
          </Link>
        </div>
        llm<span style={{ color: "var(--primary)" }}>ranked</span> · AI visibility tracking
      </footer>
    </main>
  );
}
