# LLMRank — AI SEO Visibility Tool

Track exactly how ChatGPT, Gemini, Llama, and Claude rank your brand when users ask the questions that matter.

---

## What it does

1. **Add a brand** — name + domain (e.g. Notion, notion.so)
2. **Add queries** — the questions your target users ask LLMs ("best note-taking app for teams") — or let the AI auto-suggest them
3. **Run a scan** — LLMRank fires your queries at all connected LLMs concurrently
4. **See results** — visibility score, LLM breakdown, competitor share of voice, per-query annotated responses
5. **Get insights** — specific, actionable recommendations tied to your actual ranking gaps

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, SQLAlchemy async, PostgreSQL, Alembic |
| LLMs | Gemini 1.5 Flash (free), Groq/Llama 3.3 70B (free), GPT-4o-mini, Claude Haiku |
| Infra | Docker Compose |

---

## Quick start

### 1. Clone and configure

```bash
git clone <repo>
cd llmrank
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_key        # Free: aistudio.google.com
GROQ_API_KEY=your_key          # Free: console.groq.com
OPENAI_API_KEY=your_key        # Optional — paid
ANTHROPIC_API_KEY=your_key     # Optional — paid
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

### 3. Manual dev setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Set up PostgreSQL and update DATABASE_URL in .env
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Free tier guide

Run the whole product for free:

| LLM | Provider | Cost | Limit |
|---|---|---|---|
| Gemini 1.5 Flash | Google AI Studio | Free | 1,500 req/day |
| Llama 3.3 70B | Groq | Free | ~14,400 req/day |

Leave `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` empty — those LLMs simply won't appear in results.

---

## API reference

Full interactive docs at `/docs` (Swagger UI) when the backend is running.

Key endpoints:

```
POST   /api/v1/brands                              Create brand
GET    /api/v1/brands                              List brands
GET    /api/v1/brands/{id}/dashboard               Full dashboard data
POST   /api/v1/brands/{id}/scans                   Trigger scan
GET    /api/v1/brands/{id}/scans/{scanId}/stream   SSE live scan progress
GET    /api/v1/brands/{id}/queries                 List queries
POST   /api/v1/brands/{id}/queries/suggest         AI query suggestions
GET    /api/v1/brands/{id}/queries/{queryId}/drilldown  Per-query drilldown
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Next.js Frontend                                   │
│  ├── / (home — brand list)                          │
│  ├── /brands/[id] (dashboard — SSR)                 │
│  └── /brands/[id]/queries/[qid] (drilldown — SSR)   │
└──────────────────────┬──────────────────────────────┘
                       │ REST + SSE
┌──────────────────────▼──────────────────────────────┐
│  FastAPI Backend                                    │
│  ├── Scan orchestrator (asyncio, parallel LLM calls)│
│  ├── Ranking engine (mention, position, sentiment)  │
│  ├── Insight engine (actionable recommendations)    │
│  └── LLM adapters (Gemini, Groq, OpenAI, Claude)   │
└──────────────────────┬──────────────────────────────┘
                       │ SQLAlchemy async
┌──────────────────────▼──────────────────────────────┐
│  PostgreSQL                                         │
│  brands → monitored_queries → scans → query_results │
└─────────────────────────────────────────────────────┘
```

---

## Ranking engine

Each LLM response runs through a 5-step pipeline:

1. **Brand normalization** — generates fuzzy match variants (CamelCase, domain root, etc.)
2. **Position detection** — finds numbered lists first, falls back to mention order
3. **Sentiment analysis** — scores positive/negative signals in brand-adjacent sentences
4. **Competitor extraction** — identifies and ranks competitors mentioned in the response
5. **Response annotation** — tokenizes the response into colored spans (brand/competitor/qualifier/neutral)

Score formula (0–100):
- Not mentioned: 5–15
- Mentioned: 40 base + position bonus (#1=+35, #2=+25, #3=+15) + sentiment bonus (positive=+20)

---

## Design

Luxury car aesthetic: obsidian backgrounds (`#08090A`), warm platinum text (`#F0EDE8`), champagne gold accents (`#C9A84C`). Think Rolls-Royce configurator meets Bloomberg Terminal.

CSS custom properties are defined in `globals.css` — all colors reference variables, making theming a one-file change.

---

## Roadmap

- [ ] Scheduled automatic scans (cron)
- [ ] Email/Slack alerts on score drops
- [ ] Anonymous Shareable report links
- [ ] Score trend notifications
- [ ] Multi-user / team support
- [ ] Export to PDF report
# llmrank
