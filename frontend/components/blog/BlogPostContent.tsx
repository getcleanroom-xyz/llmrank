"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { BlogPost } from "@/lib/blog";

function PushPin() {
  return (
    <svg width="20" height="24" viewBox="0 0 20 24" fill="none" style={{ position: "absolute", top: -11, left: 16, zIndex: 2 }}>
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

const markdownComponents: Components = {
  blockquote: ({ children }) => (
    <div
      style={{
        position: "relative",
        margin: "2em -12px",
        padding: "16px 18px",
        background: "#FFF9DB",
        border: "2px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "3px 3px 0 #1A1A1A",
        transform: "rotate(0.3deg)",
      }}
    >
      <svg width="16" height="18" viewBox="0 0 16 18" fill="none" style={{ position: "absolute", top: -9, left: 10 }}>
        <ellipse cx="8" cy="4" rx="4" ry="4" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
        <rect x="6" y="8" width="4" height="6" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
      </svg>
      <div style={{ fontFamily: "var(--font-sans), Inter, sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  ),
  h2: ({ children }) => (
    <div style={{ margin: "2.2em 0 0.8em" }}>
      <h2 style={{ fontFamily: "var(--font-sans), Inter, sans-serif", fontSize: "clamp(20px, 2.8vw, 26px)", fontWeight: 800, margin: "0 0 4px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
        {children}
      </h2>
      <ScribbleUnderline color="var(--primary)" width="60%" />
    </div>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, background: "linear-gradient(to bottom, transparent 60%, var(--primary) 60%)", padding: "0 2px" }}>
      {children}
    </strong>
  ),
  hr: () => (
    <div style={{ textAlign: "center", margin: "2em 0", fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 18, color: "var(--text-muted)" }}>
      ~ ~ ~
    </div>
  ),
};

function isSocialSnippet(text: string): boolean {
  const trimmed = text.trim().toUpperCase();
  return trimmed.startsWith("TWITTER:") || trimmed.startsWith("LINKEDIN:") || trimmed.startsWith("NEWSLETTER:");
}

function SocialSnippet({ label, content }: { label: string; content: string }) {
  const labelClass = `social-snippet-label ${label.toLowerCase()}`;
  return (
    <div className="social-snippet">
      <span className={labelClass}>{label}</span>
      <div>{content.trim()}</div>
    </div>
  );
}

function parseSocialSnippets(children: React.ReactNode): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let socialStarted = false;
  let socialContent: React.ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (socialStarted) {
      socialContent.push(child);
    } else if (typeof child === "string" && isSocialSnippet(child)) {
      socialStarted = true;
      const lines = child.split("\n");
      const firstLine = lines[0];
      const label = firstLine.replace(":", "").trim();
      const rest = lines.slice(1).join("\n");
      if (rest.trim()) {
        socialContent.push(<SocialSnippet key={label} label={label} content={rest} />);
      }
    } else {
      result.push(child);
    }
  });

  if (socialContent.length > 0) {
    result.push(
      <div key="social-snippets" className="social-snippets">
        {socialContent}
      </div>
    );
  }

  return result;
}

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
        <header style={{ paddingTop: "clamp(32px, 6vh, 60px)", paddingBottom: 36 }}>
          <Link
            href="/blog"
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 24,
              fontFamily: "var(--font-sans), Inter, sans-serif",
              border: "1.5px solid var(--border)",
              padding: "4px 10px",
              borderRadius: "var(--radius)",
              background: "var(--surface)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            All notes
          </Link>

          <h1
            style={{
              fontFamily: "var(--font-hand), Caveat, cursive",
              fontSize: "clamp(36px, 6.5vw, 54px)",
              fontWeight: 700,
              margin: "0 0 6px",
              lineHeight: 1.1,
              transform: "rotate(-0.3deg)",
            }}
          >
            {post.title}
          </h1>

          <ScribbleUnderline color="var(--primary)" width="80%" style={{ marginBottom: 14 }} />

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              fontFamily: "var(--font-sans), Inter, sans-serif",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 600,
                background: "var(--bg-dark)",
                padding: "3px 10px",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </span>
            <span style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 16, color: "var(--text-muted)" }}>
              {minutes} min read
            </span>
          </div>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12 }}>
            {post.tags.map((tag) => (
              <span key={tag} className="pill pill-neu" style={{ fontSize: 10 }}>{tag}</span>
            ))}
          </div>
        </header>

        {/* Notebook paper card */}
        <div
          style={{
            position: "relative",
            maxWidth: 640,
            background: "#FAFAF5",
            border: "2px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "4px 4px 0 #1A1A1A",
            padding: "28px 28px 24px",
            backgroundImage: "repeating-linear-gradient(#F0EDE5 0px, #F0EDE5 1px, transparent 1px, transparent 28px)",
            backgroundPosition: "0 14px",
          }}
        >
          <PushPin />

          {/* Margin scribble decoration */}
          <svg
            width="30" height="80" viewBox="0 0 30 80" fill="none"
            style={{ position: "absolute", right: -10, top: 50, opacity: 0.3, pointerEvents: "none" }}
          >
            <path d="M25 0 Q15 10 20 20 Q28 30 12 40 Q5 50 18 60 Q25 70 10 80" stroke="var(--primary)" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>

          <svg
            width="24" height="60" viewBox="0 0 24 60" fill="none"
            style={{ position: "absolute", left: -8, bottom: 40, opacity: 0.25, pointerEvents: "none" }}
          >
            <path d="M18 0 Q5 10 12 20 Q20 30 6 40 Q2 50 15 60" stroke="#3B82F6" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>

          <div className="blog-post" style={{ position: "relative", zIndex: 1 }}>
            <ReactMarkdown
              components={{
                ...markdownComponents,
                p: ({ children }) => {
                  const extractText = (node: React.ReactNode): string => {
                    if (typeof node === "string") return node;
                    if (typeof node === "number") return String(node);
                    if (React.isValidElement(node)) {
                      const props = node.props as { children?: React.ReactNode };
                      return extractText(props.children);
                    }
                    if (Array.isArray(node)) return node.map(extractText).join("");
                    return "";
                  };
                  
                  const text = extractText(children);
                  
                  if (isSocialSnippet(text)) {
                    const lines = text.split("\n");
                    const firstLine = lines[0];
                    const label = firstLine.replace(":", "").trim();
                    const rest = lines.slice(1).join("\n");
                    return (
                      <div className="social-snippet">
                        <span className={`social-snippet-label ${label.toLowerCase()}`}>{label}</span>
                        <div>{rest.trim()}</div>
                      </div>
                    );
                  }
                  return <p>{children}</p>;
                },
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Bottom margin decoration */}
          <div style={{ textAlign: "center", marginTop: 16, fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 16, color: "var(--text-muted)", opacity: 0.5 }}>
            ~ fin ~
          </div>
        </div>

        {/* Read next */}
        {morePosts.length > 0 && (
          <section style={{ marginTop: 40, fontFamily: "var(--font-sans), Inter, sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h2 className="section-label" style={{ marginBottom: 0 }}>Read next</h2>
              <svg width="50" height="12" viewBox="0 0 50 12" fill="none">
                <path d="M0 6 Q8 2 16 8 Q24 12 32 5 Q40 2 50 8" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              {morePosts.map((p, idx) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <article
                    className="card"
                    style={{
                      padding: "16px 18px",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      transform: `rotate(${idx === 0 ? "-0.3deg" : "0.3deg"})`,
                      transition: "box-shadow 0.15s, transform 0.15s",
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: "var(--font-hand), Caveat, cursive",
                        fontSize: 22,
                        fontWeight: 700,
                        margin: "0 0 6px",
                        lineHeight: 1.2,
                      }}
                    >
                      {p.title}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px", lineHeight: 1.5, flex: 1 }}>
                      {p.summary}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                        {new Date(p.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
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
