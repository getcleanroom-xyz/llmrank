import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { getBlogPost, getAllBlogPosts } from "@/lib/blog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Not Found" };
  return {
    title: `${post.title} — LLMRank Blog`,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <main>
      <article>
        <header style={{ paddingTop: "clamp(32px, 6vh, 60px)", paddingBottom: 24 }}>
          <Link
            href="/blog"
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-block",
              marginBottom: 16,
            }}
          >
            &larr; All posts
          </Link>
          <h1
            style={{
              fontSize: "clamp(24px, 5vw, 36px)",
              fontWeight: 800,
              margin: "0 0 8px",
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {post.title}
          </h1>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
              {new Date(post.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {post.tags.map((tag) => (
                <span key={tag} className="pill pill-neu" style={{ fontSize: 10 }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="md-content" style={{ paddingBottom: 40, maxWidth: 680 }}>
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
