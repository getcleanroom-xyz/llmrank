import Link from "next/link";
import type { Metadata } from "next";
import { getAllBlogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — LLMRank",
  description:
    "Notes on AI visibility, generative engine optimization, and how brands show up in ChatGPT, Gemini, and other AI models.",
};

export const dynamic = "force-static";

function readingTime(text: string): number {
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / 200));
}

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <main>
      <header style={{ paddingTop: "clamp(36px, 6vh, 64px)", paddingBottom: 32 }}>
        <h1
          style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "clamp(32px, 6vw, 48px)",
            fontWeight: 700,
            margin: "0 0 8px",
            letterSpacing: "-0.03em",
          }}
        >
          Notes on AI visibility
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            maxWidth: 480,
            fontFamily: "var(--font-serif), Georgia, serif",
          }}
        >
          Honest writing about how brands actually show up in AI models, what works, and what doesn&apos;t.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 48 }}>
        {posts.map((post, i) => {
          const mins = readingTime(post.content);

          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                className="card blog-index-card"
                style={{
                  padding: 0,
                  display: "flex",
                  overflow: "hidden",
                  borderLeft: `6px solid ${
                    i === 0 ? "var(--primary)" : i === 1 ? "#3B82F6" : i === 2 ? "#22C55E" : "#A855F7"
                  }`,
                  borderRight: "2px solid var(--border)",
                  borderTop: "2px solid var(--border)",
                  borderBottom: "2px solid var(--border)",
                  transition: "box-shadow 0.15s, transform 0.15s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ padding: "20px 22px" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        marginBottom: 8,
                        fontFamily: "var(--font-sans), Inter, sans-serif",
                      }}
                    >
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                        {new Date(post.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>&middot;</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                        {mins} min read
                      </span>
                    </div>

                    <h2
                      style={{
                        fontFamily: "var(--font-serif), Georgia, serif",
                        fontSize: "clamp(18px, 3vw, 24px)",
                        fontWeight: 700,
                        margin: "0 0 8px",
                        lineHeight: 1.3,
                        letterSpacing: "-0.015em",
                      }}
                    >
                      {post.title}
                    </h2>

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
                        <span key={tag} className="pill pill-neu" style={{ fontSize: 10 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>

      <div
        className="card"
        style={{
          padding: "24px 28px",
          marginBottom: 40,
          borderColor: "var(--primary)",
          fontFamily: "var(--font-sans), Inter, sans-serif",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Want to know how you rank in AI?</h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
          Check how your brand appears in ChatGPT, Gemini, and Claude. It takes under a minute and it&apos;s free.
        </p>
        <Link href="/" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
          Start tracking
        </Link>
      </div>
    </main>
  );
}
