# ForgeWriter AI — Tech Stack & Architecture Design

**Date:** 2026-06-08
**Status:** Approved
**Session:** Brainstorming — tech stack finalization

---

## Summary

This document captures the finalized technology stack and architecture decisions for the ForgeWriter AI project — a local-first, agentic AI novel-writing workspace for Hungarian-language fiction, inspired by NovelCrafter, Sudowrite, and BookNova.

---

## Architecture Decision: Hybrid Deployment

**Decision:** Hybrid — Docker Compose for local development, Vercel-ready for production deployment.

**Rationale:**
- Local development stays simple: one `docker compose up` starts everything
- Production path exists without redesign: Next.js deploys to Vercel, FastAPI to a container host, Postgres to Neon
- Ollama stays local — the AI inference layer never moves to the cloud unless the user explicitly enables cloud models
- Data privacy: manuscript text never leaves the user's machine in local mode

**Docker Compose services (MVP):**
- `web` — Next.js frontend (port 3000)
- `api` — FastAPI backend (port 8000)
- `worker` — RQ background worker (same image as api)
- `postgres` — PostgreSQL 16 with pgvector extension (port 5432)
- `redis` — Redis 7 for job queue (port 6379)
- `ollama` — Ollama local LLM runtime (port 11434)

**Removed from original plan:** Qdrant — replaced by pgvector in MVP and V1.

---

## Monorepo Structure

**Decision:** Turborepo + pnpm workspaces

```
forgewriter-ai/
  apps/
    web/          ← Next.js 15 frontend
    api/          ← FastAPI backend
  packages/
    shared/       ← shared TypeScript types and constants
    prompts/      ← prompt templates (versioned .txt files)
  infra/
    docker/
  docs/
  scripts/
  turbo.json
  pnpm-workspace.yaml
  docker-compose.yml
  .env.example
```

**Commands:**
- `turbo dev` — starts web and api in parallel with hot reload
- `turbo build` — builds only changed packages (cached)
- `turbo test` — runs all tests

---

## Frontend Stack

| Layer | Technology | Version | Phase |
| ----- | ---------- | ------- | ----- |
| Framework | Next.js | 15 (App Router) | MVP |
| Language | TypeScript | 5.x strict mode | MVP |
| Styling | Tailwind CSS | 4.x | MVP |
| Component library | shadcn/ui (+ Radix UI primitives) | latest | MVP |
| Animation | Framer Motion | 11.x | MVP |
| Icons | Lucide React | latest | MVP |
| Rich text editor | Tiptap | 2.x | MVP |
| Toast notifications | Sonner | latest | MVP |
| Client state | Zustand | 5.x | MVP |
| Server state | TanStack Query | 5.x | MVP |
| Forms | React Hook Form + Zod | latest | MVP |
| Drag and drop | dnd-kit | 6.x | V1 |
| Graph visualization | React Flow / xyflow | 12.x | V1 |
| Command palette | cmdk | latest | V1 |

**Notes:**

- Radix UI is a transitive dependency of shadcn/ui — installed automatically, not configured separately
- Sonner integrates directly with shadcn/ui via `npx shadcn add sonner`
- cmdk is already a shadcn/ui dependency — activating it in V1 requires only adding the Command component

---

## Backend Stack

| Layer | Technology | Version |
| ----- | ---------- | ------- |
| Framework | FastAPI | 0.115.x |
| Validation | Pydantic | 2.x |
| ORM | SQLAlchemy | 2.0 async |
| Migrations | Alembic | 1.x |
| Database | PostgreSQL | 16 |
| Vector extension | pgvector | 0.7.x |
| Job queue | Redis + RQ | 7 + 1.16.x |
| Linter | Ruff | latest |
| Test runner | pytest + httpx | latest |

---

## AI Layer

### Provider abstraction: LiteLLM

All AI calls go through LiteLLM. This gives a unified interface across:

| Provider | Use case | Phase |
| -------- | -------- | ----- |
| Ollama (local) | Scene drafting, rewrite, brainstorm | MVP |
| Google AI Studio (Gemini) | Polish, review, long-context critique | MVP |
| OpenRouter | Alternative cloud models | V1 |
| vLLM (self-hosted GPU) | High-volume inference | V2 optional |

**Configuration example:**
```python
response = await litellm.acompletion(
    model="ollama/gemma3:12b",       # or "gemini/gemini-2.0-flash"
    messages=[{"role": "user", "content": prompt}],
    api_base=settings.OLLAMA_BASE_URL,  # ignored for cloud models
)
```

### Agent orchestration: PydanticAI

PydanticAI is used for structured, type-safe agent workflows. Each workflow has:
- typed input schema (Pydantic model)
- typed output schema (Pydantic model)
- explicit tool definitions
- model-agnostic execution

**Why PydanticAI over LangGraph:**
- No LangChain dependency
- Cleaner Python code
- Type safety matches the rest of the codebase
- Easier to test with mock providers
- Better fit for multiple smaller pipelines than one large graph

**MVP agents (direct LiteLLM calls, no PydanticAI yet):**
- rewrite selected text
- generate scene from beats
- basic continuity check

**V1 agents (PydanticAI):**
- SceneWriterAgent
- ContinuityCheckerAgent
- HungarianEditorAgent
- BrainstormAgent

**V2 agents (PydanticAI multi-step pipelines):**
- ChapterPlannerAgent
- DevelopmentalEditorAgent
- QualityGateAgent
- SummaryMemoryAgent

---

## Database Design

### PostgreSQL + pgvector

Single database for both structured data and vector embeddings.

**Why pgvector over Qdrant (MVP/V1):**
- No separate service to run
- Neon PostgreSQL supports pgvector natively
- JOIN queries between entities and their embeddings in one query
- Sufficient for MVP and V1 scale (< 100k vectors per project)
- Migration path to Qdrant available if needed in V2

**pgvector index:**
```sql
CREATE INDEX ON codex_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Qdrant upgrade trigger:** If retrieval latency exceeds 200ms or corpus exceeds 500k vectors per project.

---

## Authentication (MVP)

**Decision:** Simple JWT with hardcoded credentials in `.env`

```env
AUTH_USERNAME=forgewriter
AUTH_PASSWORD=your-local-password
JWT_SECRET=generate-a-random-secret
```

**Why not full auth in MVP:**
- Single-user local app — no multi-user risk
- Auth.js/Clerk adds significant complexity
- Can be added in V1 for cloud deployment

---

## Background Jobs

**Decision:** Redis + RQ (Redis Queue)

Job types:
- `generate_scene` — scene draft from beats
- `rewrite_text` — rewrite selected passage
- `check_continuity` — scan scene against Codex
- `refresh_embeddings` — update pgvector index after Codex edit
- `export_book` — Markdown/DOCX/EPUB generation

**Worker architecture:**
```python
# apps/api/app/workers/main.py
from rq import Worker, Queue
from redis import Redis

redis_conn = Redis.from_url(settings.REDIS_URL)
queue = Queue(connection=redis_conn)
worker = Worker([queue], connection=redis_conn)
worker.work()
```

---

## Export Pipeline

| Format | Phase | Tool |
| ------ | ----- | ---- |
| Markdown | MVP | Native Python string generation |
| DOCX | V1 | Pandoc via subprocess |
| EPUB | V1 | Pandoc via subprocess |
| PDF | V2 | Pandoc + LaTeX or Playwright HTML→PDF |

---

## Design System

Color tokens (defined in `apps/web/src/styles/tokens.ts`):

```typescript
export const tokens = {
  background: "#f8f6f2",
  surface: "#ffffff",
  surfaceMuted: "#f1eee8",
  border: "#ded8ce",
  text: "#2f2a24",
  textMuted: "#6f675f",
  accent: "#6d5dfc",
  accentMuted: "#ebe9ff",
  ai: "#7c3aed",
  aiMuted: "#f0e9ff",
  success: "#2f7d55",
  warning: "#b7791f",
  danger: "#c2410c",
}
```

UI font: Inter or Geist
Manuscript font: Literata (serif)

---

## Phase roadmap summary

### MVP
Core writing workspace: CRUD, Tiptap editor, basic LiteLLM AI, Markdown export, JWT auth.

### V1
Full workspace: PydanticAI agents, pgvector RAG, SSE streaming, dnd-kit board, Pandoc export, React Flow relationship map.

### V2
Agentic chapter pipeline: multi-step PydanticAI workflows, quality gate scoring, batch generation, cloud reviewer routing.

### Later
Tauri desktop wrapper, dark theme, Auth.js for cloud, multi-user collaboration, KDP formatting.

---

## Open questions (resolved as of 2026-06-08)

- ~~LangGraph vs PydanticAI~~ → **PydanticAI**
- ~~Qdrant vs pgvector~~ → **pgvector** (Qdrant optional V2)
- ~~Local-only vs Vercel~~ → **Hybrid**
- ~~Monorepo tooling~~ → **Turborepo + pnpm**
- ~~Background jobs~~ → **RQ**
- ~~Auth in MVP~~ → **JWT + .env**
- ~~Animation library~~ → **Framer Motion**
