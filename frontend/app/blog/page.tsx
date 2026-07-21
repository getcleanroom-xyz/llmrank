import Link from "next/link";
import type { Metadata } from "next";
import { getAllBlogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | LLMRanked",
  description:
    "Notes on AI visibility, generative engine optimization, and how brands show up in ChatGPT, Gemini, and other AI models.",
};

export const dynamic = "force-static";

function readingTime(text: string): number {
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / 200));
}

const NOTE_COLORS = [
  { bg: "#FFF9DB", border: "#E6C700", accent: "var(--primary)" },
  { bg: "#DBEAFF", border: "#3B82F6", accent: "#3B82F6" },
  { bg: "#E6F9ED", border: "#22C55E", accent: "#22C55E" },
  { bg: "#F3E8FF", border: "#A855F7", accent: "#A855F7" },
];

const ROTATIONS = ["-0.8deg", "0.5deg", "-0.4deg", "1deg"];

function PushPin() {
  return (
    <svg width="20" height="24" viewBox="0 0 20 24" fill="none" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
      <ellipse cx="10" cy="5" rx="5" ry="5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
      <rect x="8" y="10" width="4" height="8" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
    </svg>
  );
}

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

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <main>
      <header style={{ paddingTop: "clamp(36px, 6vh, 64px)", paddingBottom: 36 }}>
        <h1
          style={{
            fontFamily: "var(--font-hand), Caveat, cursive",
            fontSize: "clamp(40px, 7vw, 60px)",
            fontWeight: 700,
            margin: "0 0 8px",
            lineHeight: 1,
            color: "var(--text)",
            transform: "rotate(-0.5deg)",
          }}
        >
          Notes on AI visibility
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: -4 }}>
          <ScribbleUnderline width="220px" />
        </div>
        <p
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            maxWidth: 480,
            fontFamily: "var(--font-serif), Georgia, serif",
            marginTop: 10,
          }}
        >
          Honest writing about how brands actually show up in AI models, what works, and what doesn&apos;t.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingBottom: 48 }}>
        {posts.map((post, i) => {
          const mins = readingTime(post.content);
          const colors = NOTE_COLORS[i % NOTE_COLORS.length];
          const rot = ROTATIONS[i % ROTATIONS.length];

          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                className="blog-note-card"
                style={{
                  position: "relative",
                  background: colors.bg,
                  border: "2px solid var(--border)",
                  padding: "22px 20px 18px",
                  transform: `rotate(${rot})`,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  borderRadius: "var(--radius)",
                  boxShadow: "3px 3px 0 #1A1A1A, 5px 5px 0 " + colors.border,
                }}
              >
                <PushPin />

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    marginBottom: 10,
                    fontFamily: "var(--font-sans), Inter, sans-serif",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontWeight: 600,
                      background: "var(--surface)",
                      padding: "2px 8px",
                      border: "1.5px solid var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  >
                    {new Date(post.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>&middot;</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                    {mins} min read
                  </span>
                </div>

                <h2
                  style={{
                    fontFamily: "var(--font-hand), Caveat, cursive",
                    fontSize: "clamp(24px, 4vw, 34px)",
                    fontWeight: 700,
                    margin: "0 0 8px",
                    lineHeight: 1.15,
                  }}
                >
                  {post.title}
                </h2>

                <ScribbleUnderline
                  color={colors.accent}
                  width="70%"
                  style={{ marginBottom: 10 }}
                />

                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    margin: "0 0 10px",
                    lineHeight: 1.6,
                    fontFamily: "var(--font-serif), Georgia, serif",
                  }}
                >
                  {post.summary}
                </p>

                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="pill"
                      style={{
                        fontSize: 10,
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            </Link>
          );
        })}
      </div>

      {/* CTA card */}
      <div
        style={{
          position: "relative",
          background: "#FFF9DB",
          border: "2px solid var(--border)",
          padding: "24px 28px 28px",
          marginBottom: 40,
          borderRadius: "var(--radius)",
          boxShadow: "4px 4px 0 #1A1A1A",
          transform: "rotate(0.3deg)",
          fontFamily: "var(--font-sans), Inter, sans-serif",
        }}
      >
        <PushPin />
        <h3
          style={{
            fontFamily: "var(--font-hand), Caveat, cursive",
            fontSize: 28,
            fontWeight: 700,
            margin: "0 0 4px",
            lineHeight: 1.1,
          }}
        >
          Curious how you rank in AI?
        </h3>
        <ScribbleUnderline color="var(--primary)" width="160px" style={{ marginBottom: 10 }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
          It takes under a minute. Free. No credit card.
        </p>
        <Link href="/" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
          Start tracking
        </Link>
      </div>
    </main>
  );
}
