from app.models.models import QueryResult


def generate_insights_for_query(
    brand_name: str,
    query_text: str,
    results: list,
) -> list[dict]:
    insights = []

    mentioned_results = [r for r in results if r.mentioned]
    not_mentioned = [r for r in results if not r.mentioned]
    negative_results = [r for r in results if r.sentiment == "negative"]

    all_competitors: dict[str, int] = {}
    for result in results:
        for comp in (result.competitors_mentioned or []):
            name = comp.get("name", "")
            if name:
                all_competitors[name] = all_competitors.get(name, 0) + 1

    top_competitor = max(all_competitors, key=all_competitors.get) if all_competitors else None

    # Insight: not mentioned by specific LLMs
    if not_mentioned:
        llm_names = [r.llm_name.title() for r in not_mentioned]
        verb = "doesn't" if len(llm_names) == 1 else "don't"
        llm_str = ", ".join(llm_names)
        insights.append({
            "type": "warning",
            "text": (
                f"<strong>{llm_str} {verb} mention {brand_name}</strong> for this query — "
                f"consider publishing dedicated content that directly addresses \"{query_text}\" "
                f"with structured headings so LLMs can index it clearly."
            ),
        })

    # Insight: dominant competitor
    if top_competitor and all_competitors.get(top_competitor, 0) >= 2:
        count = all_competitors[top_competitor]
        total = len(results)
        insights.append({
            "type": "warning",
            "text": (
                f"<strong>{top_competitor} appears in {count}/{total} LLM responses</strong> for this query. "
                f"Publishing a detailed \"{brand_name} vs {top_competitor}\" comparison page with honest pros/cons "
                f"is one of the most reliable ways to appear in responses where {top_competitor} currently dominates."
            ),
        })

    # Insight: negative sentiment detected
    if negative_results:
        qualifiers = []
        for r in negative_results:
            if r.annotated_response:
                for span in r.annotated_response:
                    if span.get("type") == "qualifier":
                        qualifiers.append(span.get("text", ""))

        qualifier_text = f" LLMs note: \"{qualifiers[0][:120]}...\"" if qualifiers else ""
        count = len(negative_results)
        insights.append({
            "type": "warning",
            "text": (
                f"<strong>{brand_name} is mentioned with qualifiers or caveats</strong> by {count} model(s) for this query.{qualifier_text} "
                f"Address these objections directly in your content with case studies and structured templates."
            ),
        })

    # Insight: strong performer
    strong = [r for r in mentioned_results if r.score and r.score >= 80]
    if strong:
        best_llm = max(strong, key=lambda r: r.score or 0)
        insights.append({
            "type": "tip",
            "text": (
                f"<strong>{best_llm.llm_name.title()} ranks you strongly (score: {best_llm.score:.0f}/100)</strong> for this query. "
                f"Analyze what that model's training data likely includes about {brand_name} and "
                f"replicate that content style across weaker-performing LLMs."
            ),
        })

    # Insight: full coverage
    if len(mentioned_results) == len(results) and results:
        insights.append({
            "type": "tip",
            "text": (
                f"<strong>{brand_name} is mentioned by all {len(results)} LLMs</strong> for this query. "
                f"Focus on improving position and sentiment rather than coverage — "
                f"consider creating content that positions you explicitly as the #1 recommendation."
            ),
        })

    # Insight: first-mover advantage (no competitors detected)
    if not all_competitors and mentioned_results:
        insights.append({
            "type": "tip",
            "text": (
                f"<strong>No competitors detected for \"{query_text}\"</strong> — {brand_name} may have a first-mover advantage in this space. "
                f"Create comprehensive, authoritative content now to establish dominance before competitors catch up. "
                f"LLMs reward early, detailed coverage in under-served niches."
            ),
        })

    # Generic fallback
    if len(insights) < 2:
        insights.append({
            "type": "tip",
            "text": (
                f"<strong>Add structured FAQ content</strong> targeting \"{query_text}\" — "
                f"LLMs heavily index FAQ pages and how-to guides when generating recommendations for specific use cases."
            ),
        })

    return insights[:3]


def generate_dashboard_insights(brand_name: str, all_results: list, brand_domain: str = "") -> list[dict]:
    insights = []

    if not all_results:
        return insights

    llm_scores: dict[str, list[float]] = {}
    for r in all_results:
        llm_scores.setdefault(r.llm_name, []).append(r.score or 0)

    llm_avg = {k: sum(v) / len(v) for k, v in llm_scores.items()}
    worst_llm = min(llm_avg, key=llm_avg.get) if llm_avg else None
    best_llm = max(llm_avg, key=llm_avg.get) if llm_avg else None

    if worst_llm and llm_avg[worst_llm] < 40:
        score = llm_avg[worst_llm]
        insights.append({
            "type": "warning",
            "text": (
                f"<strong>{worst_llm.title()} is your weakest channel</strong> with avg score {score:.0f}/100. "
                f"This often means {brand_name}'s structured content isn't well-indexed by that model's training data."
            ),
        })

    if best_llm:
        score = llm_avg[best_llm]
        insights.append({
            "type": "tip",
            "text": (
                f"<strong>{best_llm.title()} is your strongest signal (avg {score:.0f}/100)</strong>. "
                f"Queries where you rank #1 there should be used as templates for generating new query variants."
            ),
        })

    # Competitor analysis — both known and dynamically detected
    comp_counts: dict[str, int] = {}
    known_comp_counts: dict[str, int] = {}
    unknown_comp_counts: dict[str, int] = {}
    for r in all_results:
        for comp in (r.competitors_mentioned or []):
            name = comp.get("name", "")
            if name:
                comp_counts[name] = comp_counts.get(name, 0) + 1
                if comp.get("known", True):
                    known_comp_counts[name] = known_comp_counts.get(name, 0) + 1
                else:
                    unknown_comp_counts[name] = unknown_comp_counts.get(name, 0) + 1

    if comp_counts:
        top = max(comp_counts, key=comp_counts.get)
        count = comp_counts[top]
        is_known = comp_counts[top] == known_comp_counts.get(top, 0)
        source = "" if is_known else " (auto-detected)"
        insights.append({
            "type": "warning",
            "text": (
                f"<strong>{top}{source} is your most-cited rival</strong>, appearing across {count} LLM responses. "
                f"A dedicated \"{brand_name} vs {top}\" comparison page is the highest-leverage content move right now."
            ),
        })

    # No competitors at all — first-mover advantage insight
    if not comp_counts and mentioned_results:
        insights.append({
            "type": "tip",
            "text": (
                f"<strong>No competitors detected across all queries</strong> — {brand_name} may have a first-mover advantage in AI search for its category. "
                f"Create comprehensive, authoritative content now to establish dominance before competitors appear in LLM responses. "
                f"Focus on \"best {brand_domain.split('.')[0]} alternatives\", \"how to use {brand_domain.split('.')[0]}\", and comparison content."
            ),
        })

    return insights[:3]
