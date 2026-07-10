import re
from dataclasses import dataclass
from typing import Optional
from difflib import SequenceMatcher


SENTIMENT_POSITIVE_SIGNALS = [
    "excellent", "best", "top", "great", "perfect", "ideal", "recommended",
    "popular", "leading", "powerful", "intuitive", "versatile", "robust",
    "seamless", "loved", "favorite", "go-to", "standout", "exceptional",
]

SENTIMENT_NEGATIVE_SIGNALS = [
    "complex", "complicated", "expensive", "limited", "difficult", "clunky",
    "slow", "buggy", "unstructured", "overwhelming", "cluttered", "pricey",
    "lacking", "poor", "weak", "inferior", "frustrating", "confusing",
]

QUALIFIER_SIGNALS = [
    "but", "however", "although", "though", "despite", "unless",
    "can feel", "may seem", "might be", "could be", "some find",
    "learning curve", "requires", "caveat", "note that",
]

# Common known competitors by category (expandable)
KNOWN_COMPETITORS = [
    "notion", "coda", "clickup", "asana", "linear", "jira", "trello",
    "monday", "basecamp", "airtable", "confluence", "obsidian", "craft",
    "roam", "logseq", "height", "todoist", "slack", "figma", "miro",
    "hubspot", "salesforce", "zendesk", "intercom", "freshdesk",
    "shopify", "webflow", "framer", "wordpress", "squarespace",
    "mailchimp", "klaviyo", "stripe", "paddle", "lemon squeezy",
    "vercel", "netlify", "supabase", "firebase", "planetscale",
    "openai", "anthropic", "cohere", "mistral", "perplexity",
]


def strip_markdown(text: str) -> str:
    """Strip common markdown formatting from LLM responses before parsing."""
    # Bold/italic: **text**, *text*, __text__, _text_
    text = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", text)
    text = re.sub(r"_{1,2}([^_]+)_{1,2}", r"\1", text)
    # Inline code: `text`
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Links: [text](url)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # Headers: ### text
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Horizontal rules
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


@dataclass
class RankingResult:
    mentioned: bool
    position: Optional[int]
    sentiment: str
    sentiment_score: float
    competitors: list[dict]
    annotated_spans: list[dict]
    score: float


def fuzzy_match(text: str, target: str, threshold: float = 0.8) -> bool:
    text_lower = text.lower()
    target_lower = target.lower()
    if target_lower in text_lower:
        return True
    ratio = SequenceMatcher(None, text_lower, target_lower).ratio()
    return ratio >= threshold


def normalize_brand(brand_name: str, domain: str) -> list[str]:
    """Generate brand variants to search for in LLM responses."""
    variants = set()
    variants.add(brand_name.lower())
    # Domain without TLD
    domain_root = domain.split(".")[0].lower()
    variants.add(domain_root)
    # Handle camelCase → words
    words = re.sub(r"([A-Z])", r" \1", brand_name).strip().lower()
    variants.add(words)
    return list(variants)


def extract_sentences(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in sentences if s.strip()]


def find_brand_position(sentences: list[str], brand_variants: list[str]) -> tuple[bool, Optional[int]]:
    """Find which position in an ordered list the brand appears (1-indexed)."""
    mentioned = False
    position = None

    # Look for numbered lists first
    numbered_pattern = re.compile(r"^\s*(\d+)[.)]\s+(.+)", re.MULTILINE)
    text = " ".join(sentences)
    matches = numbered_pattern.findall(text)

    if matches:
        for num_str, item_text in matches:
            for variant in brand_variants:
                if variant in item_text.lower():
                    mentioned = True
                    position = int(num_str)
                    break
            if mentioned:
                break

    # If no numbered list, find mention order in sentences
    if not mentioned:
        mention_count = 0
        for i, sentence in enumerate(sentences):
            sentence_lower = sentence.lower()
            for variant in brand_variants:
                if variant in sentence_lower:
                    mentioned = True
                    position = i + 1
                    break
            if mentioned:
                break
        if not mentioned:
            # Count how many other brands mentioned before
            for sentence in sentences:
                for comp in KNOWN_COMPETITORS:
                    if comp in sentence.lower():
                        mention_count += 1
                        break

    return mentioned, position


def analyze_sentiment(text: str, brand_variants: list[str]) -> tuple[str, float]:
    """Analyze sentiment specifically about the brand in context."""
    sentences = extract_sentences(text)
    brand_sentences = []

    for sentence in sentences:
        for variant in brand_variants:
            if variant in sentence.lower():
                brand_sentences.append(sentence.lower())
                break

    if not brand_sentences:
        return "not_mentioned", 0.0

    positive_hits = 0
    negative_hits = 0

    for sentence in brand_sentences:
        for signal in SENTIMENT_POSITIVE_SIGNALS:
            if signal in sentence:
                positive_hits += 1
        for signal in SENTIMENT_NEGATIVE_SIGNALS:
            if signal in sentence:
                negative_hits += 1

    if positive_hits > negative_hits:
        score = min(1.0, 0.6 + 0.1 * positive_hits)
        return "positive", score
    elif negative_hits > positive_hits:
        score = max(0.0, 0.4 - 0.1 * negative_hits)
        return "negative", score
    else:
        return "neutral", 0.5


# Words that are category descriptions, not competitor names
GENERIC_TERMS = {
    "networking", "professional", "social", "platform", "tool", "app", "software",
    "service", "product", "solution", "website", "page", "site", "blog", "review",
    "comparison", "alternative", "alternative to", "personal", "business", "enterprise",
    "open source", "free", "premium", "freemium", "saas", "platform as a service",
}


def extract_competitors(text: str, brand_variants: list[str]) -> list[dict]:
    """Extract competitors from numbered lists. Fully dynamic detection."""
    found = []
    seen = set()

    # Parse numbered lists — most reliable
    numbered_pattern = re.compile(r"(\d+)[.)]\s+([^\n.]+)", re.MULTILINE)
    matches = numbered_pattern.findall(text)

    for num_str, item_text in matches:
        clean = item_text.strip()
        is_brand = any(v in clean.lower() for v in brand_variants)
        if is_brand:
            continue

        # Extract: look for a multi-word proper noun, or a short capitalized phrase
        # that's NOT a generic category word
        lead_match = re.match(
            r"^[:\s]*([A-Z][a-zA-Z0-9]+(?:[\s+\-/]+[A-Z0-9][a-zA-Z0-9]*){0,3})",
            clean,
        )
        if lead_match:
            candidate = lead_match.group(1).strip()
        else:
            # Try lowercase brand-style names (e.g., "notion", "clickup")
            lower_match = re.match(r"^[:\s]*([a-z][a-zA-Z0-9]+(?:[\s+\-/]+[a-zA-Z0-9]+){0,2})", clean)
            if lower_match:
                candidate = lower_match.group(1).strip()
            else:
                words = clean.split()[:3]
                candidate = " ".join(words)

        # Filter: must be at least 2 chars, not a generic term, not the brand
        candidate_lower = candidate.lower().strip("*")
        if (
            len(candidate) >= 2
            and candidate_lower not in seen
            and not any(v in candidate_lower for v in brand_variants)
            and candidate_lower not in GENERIC_TERMS
            and not any(t in candidate_lower for t in GENERIC_TERMS)
        ):
            # Clean remaining markdown
            clean_name = re.sub(r"[*_`]", "", candidate).strip()
            if clean_name:
                seen.add(candidate_lower)
                found.append({"name": clean_name, "position": int(num_str)})

    if found:
        return sorted(found, key=lambda x: x["position"])

    # Fallback: sentence order — only multi-word capitalized phrases
    sentences = extract_sentences(text)
    for i, sentence in enumerate(sentences):
        lead_matches = re.findall(r"([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){1,3})", sentence)
        for candidate in lead_matches:
            cl = candidate.lower()
            if (
                cl not in seen
                and not any(v in cl for v in brand_variants)
                and cl not in GENERIC_TERMS
                and not any(t in cl for t in GENERIC_TERMS)
            ):
                seen.add(cl)
                found.append({"name": candidate, "position": i + 1})

    return found[:10]


def annotate_response(text: str, brand_variants: list[str], competitors: list[dict]) -> list[dict]:
    """
    Tokenize the response into annotated spans:
    - brand mention → type: "brand"
    - competitor mention → type: "competitor", entity: name
    - qualifier/caveat sentence → type: "qualifier"
    - everything else → type: "neutral"
    """
    sentences = extract_sentences(text)
    spans = []
    competitor_names_lower = {c["name"].lower() for c in competitors}

    for sentence in sentences:
        sentence_lower = sentence.lower()
        is_brand = any(v in sentence_lower for v in brand_variants)
        is_competitor = any(c in sentence_lower for c in competitor_names_lower)
        is_qualifier = any(q in sentence_lower for q in QUALIFIER_SIGNALS) and is_brand

        if is_qualifier:
            spans.append({"text": sentence, "type": "qualifier"})
        elif is_brand:
            # Find which competitor entity if mixed
            entity = None
            for comp_name in competitor_names_lower:
                if comp_name in sentence_lower:
                    entity = comp_name.title()
                    break
            spans.append({"text": sentence, "type": "brand", "entity": entity})
        elif is_competitor:
            entity = None
            for comp_name in competitor_names_lower:
                if comp_name in sentence_lower:
                    entity = comp_name.title()
                    break
            spans.append({"text": sentence, "type": "competitor", "entity": entity})
        else:
            spans.append({"text": sentence, "type": "neutral", "entity": None})

    return spans


def compute_score(mentioned: bool, position: Optional[int], sentiment: str, total_results: int = 5) -> float:
    """
    Score 0–100:
    - Not mentioned: 0–15 (baseline noise)
    - Mentioned: base 40 + position bonus + sentiment bonus
    """
    if not mentioned:
        return round(5.0 + (total_results * 2), 1)

    base = 40.0
    # Position bonus: #1 = +35, #2 = +25, #3 = +15, #4 = +8, #5+ = +3
    position_bonus = {1: 35, 2: 25, 3: 15, 4: 8}.get(position or 99, 3)
    sentiment_bonus = {"positive": 20, "neutral": 10, "negative": 0}.get(sentiment, 0)

    raw = base + position_bonus + sentiment_bonus
    return round(min(100.0, raw), 1)


def rank_response(
    brand_name: str,
    domain: str,
    llm_response: str,
) -> RankingResult:
    """Full pipeline: run all ranking analysis on a single LLM response."""
    clean = strip_markdown(llm_response)
    brand_variants = normalize_brand(brand_name, domain)
    sentences = extract_sentences(clean)

    mentioned, position = find_brand_position(sentences, brand_variants)
    sentiment, sentiment_score = analyze_sentiment(clean, brand_variants)
    competitors = extract_competitors(clean, brand_variants)
    annotated = annotate_response(clean, brand_variants, competitors)
    score = compute_score(mentioned, position, sentiment)

    return RankingResult(
        mentioned=mentioned,
        position=position,
        sentiment=sentiment if mentioned else "not_mentioned",
        sentiment_score=sentiment_score,
        competitors=competitors,
        annotated_spans=annotated,
        score=score,
    )
