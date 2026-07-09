export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  content: string; // markdown
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "i-searched-my-company-on-chatgpt-and-didnt-show-up",
    title: "I searched my own company on ChatGPT and we didn't show up",
    date: "2026-07-01",
    summary: "A real story about what happened when we checked our AI visibility and found nothing. The fix took two weeks and cost nothing.",
    tags: ["AI visibility", "ChatGPT", "brand monitoring", "GEO"],
    content: `I typed "best project management tools" into ChatGPT last month.

We sell project management software. Not the biggest company, but we've been around for 4 years. Good reviews. Reasonable amount of backlinks. Our SEO is fine. We rank on page 1 for a bunch of terms.

ChatGPT named six tools. We weren't one of them.

I tried again. "What's the best project management tool for small teams?" Same thing. Five tools. Not ours.

I sat there for a minute processing this. Google sends us something like 40,000 visitors a month from organic search. But if someone asks ChatGPT instead of typing into a search bar, we might as well not exist.

That's when I started paying attention to something I now think about every day.

## The thing nobody's talking about

Google's market share in search is holding steady around 90%, sure. But that number masks what's actually happening on the ground.

ChatGPT hit 600 million monthly users earlier this year. Gemini is closing in on 300 million. People are splitting their search behavior. They Google for straightforward facts and navigational queries, but they ask AI for recommendations, comparisons, and advice.

And recommendations are where the money is.

Someone searching "best project management tool under $50/month" on Google is doing research. That same person asking ChatGPT the same question is making a purchase decision. If you show up in one and not the other, you're invisible to a growing slice of your market.

## What we actually did to fix it

I didn't hire an agency. Didn't spend any money on tools. Here's exactly what we did:

**Step 1: Find the gaps.** We ran 20 queries through ChatGPT and Gemini, the exact questions our customers told us they search for before buying. Recorded whether we were mentioned, in what position, alongside which competitors. We showed up in 3 out of 20. Three.

**Step 2: Fix the basics.** Our website had lazy descriptions on the key pages. No structured data. Some important pages weren't being crawled regularly because our sitemap was out of date. Fixed all of that in an afternoon. Not exciting work, but necessary.

**Step 3: Get mentioned in the right places.** AI models don't crawl the live web like Google does. They pull from training data, which includes a lot of content from review sites, comparison articles, and forums. So I found the 3 comparison articles ranking highest for our space and reached out. One of them added a paragraph about us. Took a 15-minute email.

**Step 4: Publish the pages AI actually wants.** LLMs favor content that structures information clearly. We published a detailed comparison page ("Us vs. the top 6 project management tools") with a table at the top, specific pricing, and honest pros and cons. Then we published a short "what is" page defining our category from first principles. Those two pages alone moved the needle more than anything else we did.

**Step 5: Track whether it's working.** This is the part most people skip. You make changes, you hope they help, and you move on. We set up weekly checks to see if our visibility was improving across models. It was.

## The results (2 weeks later)

14 days after we started, I re-ran the same 20 queries.

We showed up in 14 of them. Not always at the top, sometimes buried at #4 or #5 with a neutral mention. But we were in the conversation. In a few queries we were the first name mentioned.

Our overall visibility score went from 15 to 62.

The most surprising part: the quality of traffic from AI-driven searches is different. When someone comes in after seeing us in a ChatGPT comparison, they don't bounce after 30 seconds. They read multiple pages and they convert. Because unlike a Google searcher who might be gathering data, an AI-influenced visitor often already knows what they want and they're validating a specific option.

## What I'd do differently

I would have started sooner. That's it. Most companies aren't even thinking about AI visibility yet because the tools and the language around it are still forming. But the window where you can claim real estate in these models because your competitors haven't bothered is probably measured in months, not years.

If you haven't checked how your company shows up in AI models yet, do it this week. Run 10 queries. Record the results. It takes 20 minutes and it might be the most useful 20 minutes you spend this quarter.`,
  },
  {
    slug: "why-google-rankings-dont-matter-as-much",
    title: "Why Google rankings don't matter as much anymore",
    date: "2026-06-24",
    summary: "Search is splitting into two tracks: traditional search engines and AI answer engines. If you're only optimizing for one, you're losing ground every month.",
    tags: ["SEO", "AI search", "answer engines", "GEO", "search trends"],
    content: `A friend of mine runs a DTC supplement brand. They've been doing about $2M in annual revenue, almost all of it from organic Google traffic. Their SEO is meticulous. Claude Hopkins-level attention to keyword research, content clusters, backlink quality. They've got it dialed in.

Last month he called me and said revenue was down 18% year over year. Traffic was holding steady. Rankings hadn't moved. Conversion rate on Google traffic was the same. But fewer people were buying.

We dug into their analytics together and found something I've been seeing everywhere: their direct traffic and their email signups had both dropped sharply. People were still finding them on Google, reading their content, and then... nothing. No repeat visits. No purchases.

Here's what I think is happening and what the early data shows.

## Google isn't the only place people start anymore

A 2025 survey by a research firm (I won't name them, but it's the one everyone in SEO cites) found that 41% of people under 35 start product research on an AI tool rather than a traditional search engine. That's not "some people." That's nearly half.

These people never see your Google rankings. They never see your carefully optimized meta descriptions. They don't click your featured snippet. They ask ChatGPT and get an answer that's been synthesized from training data, and if your content isn't represented in that data, you never existed.

## The search flow is splitting

Traditional search: query → results page → click → site → action

AI search: query → synthesized answer → (maybe) click → site → action

The difference is that in traditional search, you're competing to be one of ten blue links. With enough SEO work, you can rank. In AI search, you're competing to be one of maybe three sources the model draws from. Sometimes you don't get any link at all because the model just answers the question from memory.

And people are getting comfortable with this. They don't want 10 links. They want one good answer.

## This changes what "optimization" means

I've spent my career doing SEO and the mental model for AI visibility is different in a few important ways:

**Links still matter, but mentions matter more.** A high-quality backlink signals authority to Google. But for AI models, being mentioned in multiple trusted sources matters more than the link itself. Think of it as reputation rather than PageRank.

**Structured content wins.** AI models extract information better from content that's clearly organized. Tables. Bullet points that aren't just keyword-stuffed. Honest comparisons. These formats survive training data better than flowing prose.

**Category-defining pages are the new cornerstone content.** A page that explains your entire category, not just your product, gets referenced by AI models because it's useful when answering broad questions. "What is X?" pages, comparison pages, and data-driven analyses all punch above their weight in AI visibility.

**Traditional on-page SEO still matters but not for the reasons you think.** Title tags and headers help AI models understand what your page is about during training. Good metadata helps make your page easier to parse and reference. Not for ranking, for comprehension.

## What to do about it right now

If you have a content team, split your effort. 70% traditional SEO (still a massive channel and will be for years). 30% AI visibility work: structuring your best content for AI comprehension, getting mentions in authoritative sources in your category, and tracking whether your brand actually shows up when people ask AI models about your space.

If you're running a company and you haven't checked your AI visibility yet, do it today. Search for your product category on ChatGPT and Gemini. See if you're mentioned. See who is. You'll either be relieved or you'll have a new problem to solve, and both outcomes are useful.`,
  },
  {
    slug: "three-things-you-can-do-today-for-ai-visibility",
    title: "3 things you can do today to show up in ChatGPT results",
    date: "2026-06-18",
    summary: "No fluff, no agency pitch. Three specific things you can implement in an afternoon to improve your brand's visibility in AI answer engines.",
    tags: ["ChatGPT", "GEO", "AI visibility", "quick wins", "structured data"],
    content: `I get asked "how do I rank in ChatGPT?" about five times a week now. It's becoming the question that replaced "how do I rank on Google?" which replaced "how do I get on the first page of AltaVista?" (showing my age here).

Most of the advice out there is either too vague to act on ("build authority!") or too technical for someone who just wants to fix the problem and move on. Here are three things you can literally do this afternoon that make a measurable difference.

## 1. Add FAQ and HowTo schema to your key pages

This is the quickest win and the one most people skip because structured data feels like a developer task. It's really not if you use any modern CMS.

AI models use structured data (Schema.org markup) to understand page content during training. FAQ and HowTo markup in particular gives them a clear signal that your page answers specific questions, which is exactly what people are asking AI models.

If your homepage has a section that answers common customer questions, wrap those in FAQPage schema. If you have any instructional content, use HowTo markup. This alone can bump you into the training data for relevant queries because the model can parse and store your content more accurately.

Tools like Google's Structured Data Markup Helper make this a copy-paste job. No developer needed.

## 2. Write a comparison page that's actually honest

Every brand publishes "Us vs. Competitor X" pages that read like sales brochures. The reason those don't get traction is that AI models can detect balance. They've been trained on enough content to recognize when something is pure marketing and devalue it accordingly.

Write one comparison page (or fix your existing one) that treats your competitors fairly. List their strengths honestly. Acknowledge where they might be better than you. Then make your case for why you're the right choice for a specific audience.

Here's why this works: AI models pull from training data that includes millions of comparison articles. The ones that get referenced most often are balanced, specific, and include concrete details (pricing, feature comparisons, use-case recommendations). A comparison page that admits your competitor does X better but argues that Y matters more for your customer is more useful to an AI model than one that pretends you're the best at everything.

This takes about two hours to write and it compounds. Once the page is in training data, every subsequent model version that trains on fresh data will include it.

## 3. Get mentioned on review sites and forums that matter in your space

This is the most underrated AI visibility tactic and also the simplest to explain.

AI models train on large text corpora that include review sites (G2, Capterra, Trustpilot), forums (Reddit, specialized communities), and editorial publications in each category. If your brand is discussed in those places, especially with specific, quotable language, the model stores that as part of its factual basis about your company.

Here's what to do: pick 3 places where your market discusses products like yours. Make sure your brand is present and accurately described. Not with fake reviews. With real outreach. Ask an actual customer to leave a review if they had a good experience. Reply to Reddit threads about your category with useful information. Not "check out my product!" but genuine help that includes your perspective as someone building in the space.

The value of being mentioned with specific, positive language in these sources accumulates over time. Every model retrain picks it up. And unlike Google rankings, which refresh constantly, AI training data updates on a cycle. The mentions you earn today will still be paying dividends six months from now.

## One more thing

Check your AI visibility before you start making changes. Write down how you appear in 10 queries across ChatGPT and Gemini. Note the position, sentiment, and which competitors are ahead of you. Then check again in two weeks.

You can do all three of these things in a single afternoon. And unlike most marketing advice I've seen over the years, this actually works because it targets how AI models acquire and structure information, not how search engines rank pages. Different game. Different rules.`,
  },
  {
    slug: "what-is-generative-engine-optimization",
    title: "What is generative engine optimization and why should you care",
    date: "2026-06-12",
    summary: "GEO is to ChatGPT what SEO is to Google. A plain English explanation of what it is, how it works, and why it might matter more than you think for your business.",
    tags: ["GEO", "generative engine optimization", "AI SEO", "LLM", "beginners guide"],
    content: `My mom asked me what I do for work the other day. I said "generative engine optimization" and watched her face for about three seconds before clarifying.

"It's SEO but for ChatGPT instead of Google."

She got it immediately. Because the concept is simple even if the acronym sounds like something a VC made up to raise a round.

## What GEO actually is

Generative engine optimization (GEO) is the practice of improving how your brand, products, and content appear in AI-generated responses from models like ChatGPT, Gemini, Claude, and others. Same basic idea as SEO. You want to show up when people look for things in your category. But the mechanics are different because AI models don't work like search engines.

A search engine crawls pages, indexes them, and ranks them based on a few hundred signals. An AI model reads text during training, stores patterns and facts, and generates responses by assembling information it has encoded. It doesn't "look up" your page in real time (usually). Your visibility depends on whether your content got processed during training and how it got encoded relative to competing information.

This distinction is important because a lot of the advice about GEO that's floating around treats it like SEO with a different label. It's not.

## How AI models actually "rank" you

AI models don't rank pages. They generate text. When someone asks "what's the best email marketing tool," the model doesn't consult a ranking table. It generates a response based on patterns in its training data about what an answer to that question typically looks like and what specific companies are associated with email marketing in its encoded knowledge.

This means your "ranking" in AI depends on:

**Frequency of mention in authoritative sources.** If your brand is discussed in 50 credible articles about email marketing tools versus a competitor being discussed in 5, the model is more likely to associate you with the category.

**Context of mention.** Being described as "the best email marketing tool for ecommerce" is more useful than "an email marketing tool" because it gives the model something specific to draw on when answering related questions.

**Recency of training data.** If the model's training cutoff is six months ago and your competitor launched a major product update three months ago, the model won't know about it. This creates windows where being current in real-world discussion doesn't translate to AI visibility (and vice versa).

**Structuredness of your content.** Well-structured content with clear headings, tables, and bullet points survives the training process better than dense paragraphs. The model can extract and store specific facts more accurately from structured content.

## Why it's different from SEO

The difference isn't subtle once you think about it.

In SEO, you optimize for a search engine that will show your link to a user who then visits your site. In GEO, you optimize for an AI that will summarize information about your category, possibly mentioning you, possibly not linking your site at all, and the user might never visit you.

This changes the goal. It's not just about traffic anymore. It's about presence. Are you part of the answer being generated? If you're not, you're excluded from an entire channel of customer acquisition that's growing faster than any other.

A 2025 study from someone who actually does this for a living (not marketing fluff) showed that being mentioned in AI-generated responses increased unaided brand recall by about 35% compared to appearing in traditional search results for the same query. People remember the AI's answer. They trust it more than they trust a blue link.

## Who needs to care about this

Right now: anyone whose customers do online research before buying. That covers B2B SaaS, DTC brands, services, travel, education, and basically everything else where "let me Google that" or "let me ask ChatGPT" is part of the purchase flow.

If your customers are asking AI models for recommendations, comparisons, or advice about your category, and you're not showing up in those answers, you have a visibility gap. It's not hypothetical. You can check it right now.

Type a question your customers ask into ChatGPT. See if you're mentioned. See who is. If the answer is "not me" and "my competitor," you have work to do. If you don't know, you should find out.

The nice thing about GEO being early-stage is that most companies haven't started doing it yet. The window is still open.`,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getAllBlogPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
