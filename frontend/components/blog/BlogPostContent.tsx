"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { BlogPost } from "@/lib/blog";

const markdownComponents: Components = {
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: "2em 0",
        padding: "16px 20px",
        background: "var(--primary)",
        border: "2px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-sm)",
        fontFamily: "var(--font-sans), Inter, sans-serif",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text)",
        lineHeight: 1.5,
      }}
    >
      {children}
    </blockquote>
  ),
};

export function BlogPostContent({
  post,
  minutes,
  morePosts,
}: {
  post: BlogPost;
  minutes: number;
  morePosts: BlogPost[];
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <div className="reading-progress" style={{ width: `${progress}%` }} />

      <article style={{ paddingBottom: 48 }}>
        <header style={{ paddingTop: "clamp(32px, 6vh, 60px)", paddingBottom: 32 }}>
          <Link
            href="/blog"
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              textDecoration: "none",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 20,
              fontFamily: "var(--font-sans), Inter, sans-serif",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            All posts
          </Link>

          <h1
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(28px, 5.5vw, 44px)",
              fontWeight: 700,
              margin: "0 0 12px",
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              textWrap: "balance",
            }}
          >
            {post.title}
          </h1>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              fontFamily: "var(--font-sans), Inter, sans-serif",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
              {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
            <span style={{ color: "var(--border)", fontWeight: 700 }}>&middot;</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
              {minutes} min read
            </span>
          </div>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12 }}>
            {post.tags.map((tag) => (
              <span key={tag} className="pill pill-neu" style={{ fontSize: 10 }}>{tag}</span>
            ))}
          </div>
        </header>

        <div
          className="blog-post"
          style={{
            maxWidth: 640,
            padding: "24px 28px",
            background: "var(--surface)",
            border: "2px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
          }}
        >
          <ReactMarkdown components={markdownComponents}>{post.content}</ReactMarkdown>
        </div>

        {morePosts.length > 0 && (
          <section style={{ marginTop: 40, fontFamily: "var(--font-sans), Inter, sans-serif" }}>
            <div className="section-label" style={{ marginBottom: 14 }}>Read next</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {morePosts.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <article
                    className="card"
                    style={{
                      padding: "14px 16px",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      transition: "box-shadow 0.15s, transform 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "var(--shadow-hover)";
                      e.currentTarget.style.transform = "translate(-1px, -1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "var(--shadow)";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: "var(--font-serif), Georgia, serif",
                        fontSize: 16,
                        fontWeight: 700,
                        margin: "0 0 6px",
                        lineHeight: 1.35,
                      }}
                    >
                      {p.title}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.5, flex: 1 }}>
                      {p.summary}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                        {new Date(p.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>&middot;</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                        {readingTimeForList(p.content)} min read
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}

function readingTimeForList(text: string): number {
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / 200));
}
