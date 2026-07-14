---
title: "How ChatGPT decides which brands to recommend"
date: "2026-07-08"
summary: "ChatGPT doesn't rank pages. It generates text. Here's how it actually decides which brands end up in its answers — and why your brand might be missing."
tags: ["ChatGPT", "LLM", "brand visibility", "AI recommendations", "how LLMs work"]
---

I spent a week reverse-engineering how ChatGPT picks brands to mention. Not through any official documentation — OpenAI doesn't publish this — but by running hundreds of queries and watching patterns.

Here's what I found.

## ChatGPT doesn't search the web (usually)

When someone asks "what's the best email marketing tool," ChatGPT doesn't Google it. It generates a response from patterns in its training data. The model has encoded knowledge about what email marketing tools exist, what people say about them, and which ones get mentioned most often in the sources it was trained on.

This is fundamentally different from Google. Google crawls pages, indexes them, and ranks them in real time. ChatGPT assembled its knowledge during training and now generates text based on that frozen snapshot.

There are exceptions. ChatGPT has a "browse" mode that can search the web. But most users don't enable it, and even when they do, the model still defaults to its training data for most recommendation queries.

## What makes a brand get mentioned

Based on what I've observed, ChatGPT's brand selection comes down to four factors:

**1. Frequency of mention in training data.** If your brand appears in 100 articles about email marketing and a competitor appears in 20, you're more likely to be mentioned. This is the single biggest factor.

**2. Quality of the sources.** A mention in TechCrunch carries more weight than a mention in a random blog. The model has learned to associate certain publications with authority.

**3. Recency.** Newer mentions matter more. If your brand was everywhere in 2023 but disappeared in 2024, the model may deprioritize you. Training data has a cutoff, and recent data points are encoded more strongly.

**4. Context specificity.** Being described as "the best email marketing tool for ecommerce" is more useful to the model than just "an email marketing tool." Specific context gives the model something to draw on when answering related questions.

## Why some brands dominate

If you look at what ChatGPT recommends for popular categories, you'll notice the same brands appear again and again. That's not because those brands paid for placement. It's because they have massive presence in the training data — review sites, comparison articles, forum discussions, press coverage.

The compounding effect is real. Once a brand is frequently mentioned in authoritative sources, the model learns to associate it with the category. Then when users ask about the category, the model mentions it. Then writers write about it being mentioned. More training data. More mentions. The flywheel spins.

## What you can do about it

You can't change ChatGPT's training data. But you can influence what goes into future training cycles:

**Get mentioned in sources the model trusts.** Review sites, industry publications, Reddit, GitHub. These are the sources that feed the training pipeline.

**Structure your content for comprehension.** Tables, bullet points, clear definitions. The model extracts and stores information better from structured content.

**Be specific about what you do.** Don't just be "an email marketing tool." Be "the email marketing tool for ecommerce teams doing $1-10M in revenue." Specificity gives the model a reason to recommend you for specific queries.

The brands that show up in ChatGPT today aren't there because they gamed an algorithm. They're there because they built genuine presence in the sources that matter. That's a strategy that works regardless of which model dominates next year.
