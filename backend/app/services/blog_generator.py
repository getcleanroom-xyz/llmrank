"""Blog generator — creates weekly blog posts using AI research and existing voice."""
import os
import json
import base64
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

CONTENT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "frontend", "content")
BLOG_DIR = os.path.join(CONTENT_DIR, "blog")
CALENDAR_PATH = os.path.join(CONTENT_DIR, "calendar.json")

BLOG_SYSTEM_PROMPT = """You are a writer for LLMRanked, a tool that helps brands understand and improve their visibility in AI-generated answers (ChatGPT, Gemini, Claude, etc.).

YOUR VOICE:
- First person. You write like a founder who's deeply in the AEO/GEO space.
- Personal stories and specific numbers. "I typed X into ChatGPT..." not "Many users find..."
- Conversational, not corporate. No jargon without explanation.
- Direct. No "Great question!" or "In today's digital landscape..."
- Honest. Admit what you don't know. Acknowledge competitors fairly.
- Short paragraphs. Bold for emphasis. Headers that tell a story.

STRUCTURE:
- Hook with a specific moment or observation (1-2 paragraphs)
- Explain why it matters (market data, trend)
- Show what to do (numbered steps, concrete)
- Prove it works (results, numbers)
- CTA (try the tool)

DATA SOURCES YOU CAN REFERENCE:
- LLMRanked user data (anonymized): "Across 500+ brand scans on LLMRanked, we see that..."
- Your own experience building LLMRanked
- Web research on AEO/GEO trends
- General industry knowledge

WHAT NOT TO DO:
- Don't invent specific company names or case studies that didn't happen
- Don't use "In today's rapidly evolving digital landscape" or similar filler
- Don't write listicles without substance
- Don't be salesy. The product should feel like a natural solution, not a pitch.

OUTPUT FORMAT:
Return ONLY the markdown content. No frontmatter. Start with the first paragraph after the title.
The post should be 800-1500 words.
Include a "## What to do next" section near the end with actionable steps.
End with a natural transition to trying LLMRanked (not a hard sell).

SOCIAL MEDIA SNIPPETS (at the very end, separated by ---):
After the blog content, add:

---
TWITTER:
[3-5 tweet thread summarizing the post]

LINKEDIN:
[LinkedIn post version, 150-200 words]

NEWSLETTER:
[Email blurb, 2-3 sentences]
---"""


async def generate_blog_post(topic_data: dict) -> dict:
    """Generate a blog post from calendar topic data.

    Returns {"filename": str, "content": str, "social": dict, "title": str, "summary": str}.
    """
    from app.services.tools.blog_research import research_topic
    from app.services.tools.llm import call_llm

    topic = topic_data["topic"]
    angle = topic_data.get("angle", "")
    keywords = topic_data.get("keywords", [])
    audience = topic_data.get("target_audience", "business owners")

    logger.info("Researching blog topic: %s", topic)

    # Research phase
    research = await research_topic(topic, keywords)

    # Build context for the LLM
    user_msg = f"""Write a blog post for LLMRanked about this topic:

TOPIC: {topic}
ANGLE: {angle}
TARGET AUDIENCE: {audience}

WEB RESEARCH (what's already been written about this):
{research['web_context'][:3000]}

USER DATA (anonymized patterns from LLMRanked):
{research['db_context']}

TRENDING RELATED TOPICS:
{chr(10).join(f"- {t}" for t in research['trending'])}

Write the full blog post in markdown. Match the voice and style of the existing posts on the LLMRanked blog — first person, specific numbers, personal stories, conversational tone. Be honest and direct.

After the blog content, add social media snippets separated by ---.
"""

    messages = [
        {"role": "developer", "content": BLOG_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    logger.info("Generating blog post with LLM...")
    response = await call_llm(messages, model_key="claude", temperature=0.7, max_tokens=4096)

    # Parse the response
    title = _extract_title(response, topic)
    summary = _extract_summary(response, topic)
    content = _extract_content(response)
    social = _extract_social(response)
    filename = _slugify(title)

    return {
        "filename": filename,
        "title": title,
        "summary": summary,
        "content": content,
        "social": social,
        "keywords": keywords,
    }


def _extract_title(response: str, fallback: str) -> str:
    """Extract title from the generated content."""
    for line in response.split("\n"):
        line = line.strip()
        if line.startswith("# ") and not line.startswith("## "):
            return line[2:].strip()
    return fallback


def _extract_summary(response: str, fallback: str) -> str:
    """Generate a summary from the first few paragraphs."""
    lines = []
    in_content = False
    for line in response.split("\n"):
        line = line.strip()
        if line.startswith("# ") and not line.startswith("## "):
            in_content = True
            continue
        if in_content and line and not line.startswith("#") and not line.startswith("---"):
            lines.append(line)
            if len(lines) >= 2:
                break
    summary = " ".join(lines)[:200]
    return summary if summary else fallback


def _extract_content(response: str) -> str:
    """Extract the blog content (before social media snippets)."""
    parts = response.split("---")
    content = parts[0].strip()
    # Remove the title line since frontmatter has it
    lines = content.split("\n")
    if lines and lines[0].strip().startswith("# "):
        lines = lines[1:]
    return "\n".join(lines).strip()


def _extract_social(response: str) -> dict:
    """Extract social media snippets from the end of the response."""
    parts = response.split("---")
    if len(parts) < 3:
        return {"twitter": "", "linkedin": "", "newsletter": ""}

    social_text = parts[-2].strip()  # Content between last two ---
    twitter = ""
    linkedin = ""
    newsletter = ""

    current = None
    for line in social_text.split("\n"):
        line = line.strip()
        if line.upper().startswith("TWITTER"):
            current = "twitter"
            continue
        elif line.upper().startswith("LINKEDIN"):
            current = "linkedin"
            continue
        elif line.upper().startswith("NEWSLETTER"):
            current = "newsletter"
            continue
        if current and line:
            if current == "twitter":
                twitter += line + "\n"
            elif current == "linkedin":
                linkedin += line + "\n"
            elif current == "newsletter":
                newsletter += line + "\n"

    return {
        "twitter": twitter.strip(),
        "linkedin": linkedin.strip(),
        "newsletter": newsletter.strip(),
    }


def _slugify(title: str) -> str:
    """Convert title to URL-friendly slug."""
    import re
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = slug.strip("-")
    return slug[:80]


def _build_markdown(post: dict) -> str:
    """Build the full markdown file content with frontmatter."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    content = post["content"]
    if post["social"].get("twitter"):
        content += f"\n\n---\n\n**Twitter:**\n{post['social']['twitter']}\n\n"
        content += f"**LinkedIn:**\n{post['social']['linkedin']}\n\n"
        content += f"**Newsletter:**\n{post['social']['newsletter']}\n"

    frontmatter = f"""---
title: "{post['title'].replace('"', '\\"')}"
date: "{today}"
summary: "{post['summary'].replace('"', '\\"')}"
tags: {json.dumps(post.get('keywords', []))}
generated: true
---

"""
    return frontmatter + content


def _gh_headers(github_token: str) -> dict:
    """Common GitHub API headers."""
    return {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def _gh_get(ref: str, token: str, repo: str) -> dict:
    """GET a GitHub API endpoint."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"https://api.github.com/repos/{repo}/{ref}", headers=_gh_headers(token))
        resp.raise_for_status()
        return resp.json()


async def _gh_post(endpoint: str, token: str, repo: str, json_body: dict) -> dict:
    """POST to a GitHub API endpoint."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://api.github.com/repos/{repo}/{endpoint}",
            headers=_gh_headers(token),
            json=json_body,
        )
        resp.raise_for_status()
        return resp.json()


async def create_pr(post: dict, markdown_content: str) -> str | None:
    """Create a GitHub PR with the new blog post via the GitHub API. Returns PR URL or None.

    No local git needed — uses the GitHub Git Data API to create a commit on a new branch,
    then opens a PR.
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPO", "getcleanroom-xyz/llmrank")

    if not github_token:
        logger.warning("GITHUB_TOKEN not set — skipping PR creation")
        return None

    branch_name = f"blog/{post['filename']}"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    blog_path = f"frontend/content/blog/{post['filename']}.md"
    commit_message = f"blog: add \"{post['title']}\" ({today})"

    try:
        # 1. Get main branch ref
        logger.info("Getting main branch ref...")
        main_ref = await _gh_get("git/ref/heads/main", github_token, repo)
        base_sha = main_ref["object"]["sha"]

        # 2. Get the base tree
        main_commit = await _gh_get(f"git/commits/{base_sha}", github_token, repo)
        base_tree_sha = main_commit["tree"]["sha"]

        # 3. Create a new tree with the blog post file added
        file_content_b64 = base64.b64encode(markdown_content.encode("utf-8")).decode("utf-8")
        logger.info("Creating tree with blog post...")
        tree = await _gh_post("git/trees", github_token, repo, {
            "base_tree": base_tree_sha,
            "tree": [
                {
                    "path": blog_path,
                    "mode": "100644",
                    "type": "blob",
                    "content": markdown_content,
                }
            ],
        })
        new_tree_sha = tree["sha"]

        # 4. Create a commit on the new tree
        logger.info("Creating commit...")
        commit = await _gh_post("git/commits", github_token, repo, {
            "message": commit_message,
            "tree": new_tree_sha,
            "parents": [base_sha],
        })
        new_commit_sha = commit["sha"]

        # 5. Create the branch ref
        logger.info("Creating branch %s...", branch_name)
        await _gh_post("git/refs", github_token, repo, {
            "ref": f"refs/heads/{branch_name}",
            "sha": new_commit_sha,
        })

        # 6. Create the PR
        logger.info("Creating PR...")
        pr_body = f"""## New blog post: {post['title']}

**Summary:** {post['summary']}

**Keywords:** {', '.join(post.get('keywords', []))}

### Social media snippets

**Twitter:**
{post['social'].get('twitter', 'N/A')}

**LinkedIn:**
{post['social'].get('linkedin', 'N/A')}

**Newsletter:**
{post['social'].get('newsletter', 'N/A')}

---
*Generated by LLMRanked blog agent on {today}*
"""
        pr = await _gh_post("pulls", github_token, repo, {
            "title": f"blog: {post['title']}",
            "body": pr_body,
            "head": branch_name,
            "base": "main",
        })

        pr_url = pr.get("html_url", "")
        logger.info("Created PR: %s", pr_url)
        return pr_url

    except httpx.HTTPStatusError as e:
        logger.error("GitHub API error: %s %s — %s", e.response.status_code, e.request.url, e.response.text[:300])
        return None
    except Exception as e:
        logger.error("Failed to create PR: %s", e)
        return None


def load_calendar() -> list[dict]:
    """Load the content calendar."""
    if not os.path.exists(CALENDAR_PATH):
        return []
    with open(CALENDAR_PATH) as f:
        return json.load(f)


def mark_topic_used(topic: str):
    """Mark a topic as used in the calendar (removes it)."""
    calendar = load_calendar()
    calendar = [t for t in calendar if t.get("topic") != topic]
    with open(CALENDAR_PATH, "w") as f:
        json.dump(calendar, f, indent=2)


async def run_weekly_post():
    """Main entry point: generate a weekly blog post and create a PR."""
    logger.info("Starting weekly blog post generation")

    calendar = load_calendar()
    if not calendar:
        logger.warning("Content calendar is empty — nothing to generate")
        return

    # Pick the first topic (or could be randomized)
    topic_data = calendar[0]
    logger.info("Selected topic: %s", topic_data["topic"])

    try:
        post = await generate_blog_post(topic_data)
        markdown_content = _build_markdown(post)

        # Create PR via GitHub API
        pr_url = await create_pr(post, markdown_content)

        # Only mark topic as used after PR is confirmed created
        if pr_url:
            mark_topic_used(topic_data["topic"])
            logger.info("Blog post PR created: %s", pr_url)
        else:
            logger.warning("PR creation failed — topic NOT removed from calendar. Will retry next run.")

        logger.info("Weekly blog post generation complete: %s", post["title"])
        return {"title": post["title"], "pr_url": pr_url, "filename": post["filename"]}

    except Exception as e:
        logger.exception("Blog post generation failed: %s", e)
        return None
