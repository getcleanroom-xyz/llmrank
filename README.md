# LLMRank — AI SEO Visibility Tool

Track exactly how ChatGPT, Gemini, Llama, Claude, DeepSeek, and more rank your brand when users ask the questions that matter.

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
| LLMs | OpenRouter (GPT-4o, Gemini 2.5 Flash, Llama 3.3 70B, Claude Haiku, DeepSeek, Mistral, Qwen) |
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
OPENROUTER_API_KEY=your_key    # Required: openrouter.ai/keys
SECRET_KEY=change_this_to_a_random_secret
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

## Supported LLMs

All models are accessed via OpenRouter. Set `OPENROUTER_API_KEY` in your `.env` to enable:

| Model | Provider | Cost/Request |
|---|---|---|
| GPT-4o Mini | OpenAI | $0.01 |
| GPT-4o | OpenAI | $0.03 |
| Gemini 2.5 Flash | Google | $0.02 |
| Llama 3.3 70B | Meta | $0.01 |
| Llama 3.1 8B | Meta | $0.005 |
| Claude Haiku | Anthropic | $0.01 |
| DeepSeek Chat | DeepSeek | $0.01 |
| DeepSeek R1 | DeepSeek | $0.01 |
| Mistral Large | Mistral | $0.02 |
| Qwen 2.5 72B | Alibaba | $0.01 |

---

## API reference

Full interactive docs at `/docs` (Swagger UI) when the backend is running.

Key endpoints:

```
POST   /api/v1/brands                                  Create brand
GET    /api/v1/brands                                  List brands
GET    /api/v1/brands/{id}                             Get brand
DELETE /api/v1/brands/{id}                             Delete brand
GET    /api/v1/brands/{id}/dashboard                   Full dashboard data

GET    /api/v1/brands/{id}/queries                     List queries
POST   /api/v1/brands/{id}/queries                     Add query
DELETE /api/v1/brands/{id}/queries/{queryId}           Delete query
POST   /api/v1/brands/{id}/queries/suggest             AI query suggestions

POST   /api/v1/brands/{id}/scans                       Trigger scan
GET    /api/v1/brands/{id}/scans                       List scans
GET    /api/v1/brands/{id}/scans/{scanId}              Get scan
GET    /api/v1/brands/{id}/scans/{scanId}/stream       SSE live scan progress
GET    /api/v1/brands/{id}/queries/{queryId}/drilldown Per-query drilldown

GET    /api/v1/credits                                 Get credit balance
POST   /api/v1/credits/grant                           Grant credits (BMC webhook)
GET    /api/v1/credits/history                         Credit transaction history

POST   /api/v1/webhooks/bmc                            Buy Me a Coffee webhook
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
│  └── LLM adapters (OpenRouter unified gateway)     │
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

A shared component library lives in `design-system/` with reusable UI primitives (Button, Card, Input, Modal, Select, Tabs, Toast, Tooltip).

---

## Roadmap

- [ ] Scheduled automatic scans (cron)
- [ ] Email/Slack alerts on score drops
- [ ] Shareable report links
- [ ] Score trend notifications
- [ ] Multi-user / team support
- [ ] Export to PDF report
