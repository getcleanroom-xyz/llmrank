import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBlogPost, getAllBlogPosts } from "@/lib/blog";
import { BlogPostContent } from "@/components/blog/BlogPostContent";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Not Found" };
  return {
    title: `${post.title} | LLMRanked`,
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

function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const allPosts = getAllBlogPosts();
  const morePosts = allPosts.filter((p) => p.slug !== post.slug).slice(0, 2);
  const minutes = readingTime(post.content);

  return (
    <main>
      <BlogPostContent post={post} minutes={minutes} morePosts={morePosts} />
    </main>
  );
}
