import Link from "next/link";
import type { Metadata } from "next";
import { getAllBlogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — LLMRank",
  description:
    "Notes on AI visibility, generative engine optimization, and how brands show up in ChatGPT, Gemini, and other AI models.",
};

export const dynamic = "force-static";

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <main>
      <header style={{ paddingTop: "clamp(32px, 6vh, 60px)", paddingBottom: 24 }}>
        <h1 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Blog
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Notes on AI visibility, GEO, and making sure your brand shows up where it matters.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40 }}>
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>
                {post.title}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>
                {post.summary}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {post.tags.map((tag) => (
                  <span key={tag} className="pill pill-neu" style={{ fontSize: 10 }}>
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          </Link>
        ))}
      </div>
    </main>
  );
}
