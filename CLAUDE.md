# CLAUDE.md — Project Instructions for Claude Code

## Project name

Product name: **Wisdom of Alexandria** (in-app wordmark "Wisdom of Alexandria" set in Caveat). Earlier working titles — *ForgeWriter AI*, *NovaCraft* — are deprecated.

Alternative product description: **local-first, agentic AI novel-writing workspace inspired by NovelCrafter-style story organization, Sudowrite-style creative assistance, and BookNova-style chapter automation.**

> **Current state:** MVP + much of V1 are shipped, and the UI has been re-skinned to the Claude Design system. For the live status + roadmap see [docs/17](docs/17_status_and_roadmap.md); for the current design system see [docs/09](docs/09_design_system_novelcrafter_inspired.md); for the UI/screen inventory [docs/07](docs/07_ui_ux_routes_and_components.md); for the design rollout + remaining design screens [docs/18](docs/18_design_rollout_and_remaining.md).

## Core goal

Build a self-hostable / local-first AI writing platform for long-form fiction, primarily for **Hungarian-language novel writing**.

The product should feel like a structured writer workspace, not a generic chatbot.

The app must support:

- projects
- books
- series / universe
- chapters
- scenes
- beats
- characters
- locations
- worldbuilding entries
- timelines
- plotlines
- style guide
- Codex / Story Bible
- AI-assisted brainstorming
- AI scene and chapter drafting
- AI rewrite/edit/polish
- continuity checking
- export to Markdown / DOCX / EPUB / PDF

## Design direction

The UI should be **strongly inspired by NovelCrafter-like writing workspaces**, but it must not copy exact branding, trademarks, icons, layouts, or proprietary assets.

Use these UX principles:

- calm, focused, writer-first interface
- left navigation for project structure
- central editor / board / database view
- right contextual panel for Codex, AI assistant, notes, or warnings
- card-based scene and chapter planning
- searchable Codex database
- compact metadata panels
- soft borders, rounded cards, neutral backgrounds
- low-friction switching between planning and writing
- manuscript editor should feel serious and distraction-free
- AI features should be assistant-like, not intrusive

## Visual style rules

Use a **NovelCrafter-inspired but original** design system:

- light theme first, dark theme later
- warm off-white background
- neutral gray typography
- subtle accent color, preferably muted purple / indigo / blue
- rounded cards
- gentle shadows
- clear information hierarchy
- dense but readable UI
- no flashy gradients except optional small AI status highlights
- avoid childish or overly colorful UI
- no exact NovelCrafter logo, color palette, asset, icon, or screen copy

Suggested design tokens:

```ts
const theme = {
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

Fonts (current, via `apps/web/lib/fonts.ts`):

- **Inter** — UI sans (`--font-sans`)
- **Literata** — manuscript serif (`--font-serif`)
- **Cormorant Garamond** — editorial display headings (`--font-display`)
- **Caveat** — hand / brand wordmark ("Wisdom of Alexandria", `--font-hand`)

The accent is **purple `#6d5dfc`** (primary); **gold** (`--gold*`) is a secondary editorial accent (eyebrows, daily-spark, the wordmark). The block above is a summary — the authoritative, full token set (light + dark, the `--text-*` type scale, shadows, AA-derived values) lives in `apps/web/app/globals.css` and is documented in [docs/09](docs/09_design_system_novelcrafter_inspired.md). The UI is WCAG-AA verified (0 contrast failures both themes, Lighthouse a11y 100).

## Recommended stack

Monorepo:

- Turborepo + pnpm workspaces
- `apps/web` — Next.js frontend
- `apps/api` — FastAPI backend
- `packages/shared` — shared TypeScript types
- `packages/prompts` — versioned prompt templates

Frontend:

- Next.js 15 (App Router)
- React
- TypeScript (strict mode)
- Tailwind CSS 4.x
- shadcn/ui (+ Radix UI primitives)
- Framer Motion 11.x
- Tiptap 2.x editor
- dnd-kit (V1)
- React Flow / xyflow (V1)
- TanStack Query 5.x
- Zustand 5.x
- React Hook Form + Zod
- Lucide React

Backend:

- FastAPI 0.115.x
- Pydantic 2.x
- SQLAlchemy 2.0 async
- Alembic
- PostgreSQL 16 + pgvector 0.7.x (vector search built-in, no separate Qdrant in MVP/V1)
- Redis 7 + RQ 1.16.x (background jobs)
- Docker Compose (local dev)

AI:

- LiteLLM as unified provider abstraction (Ollama + Google AI Studio + OpenRouter)
- Ollama for local inference (MVP)
- Google AI Studio / Gemini as cloud reviewer (MVP optional, V1 default)
- OpenRouter as alternative cloud provider (V1)
- PydanticAI for structured agent orchestration (V1+)
- Direct LiteLLM calls for MVP AI features (no orchestration framework needed yet)
- Custom ModelRouter service — all AI calls go through it
- RAG over Codex + manuscript summaries via pgvector

Export:

- Markdown: native Python string generation (MVP)
- DOCX: Pandoc via subprocess (V1)
- EPUB: Pandoc via subprocess (V1)
- PDF: Pandoc + LaTeX or Playwright HTML→PDF (V2)

Auth (MVP):

- JWT + hardcoded `.env` credentials (single-user local app)
- Auth.js for cloud deployment (V1 later)

## Repository structure

```text
forgewriter-ai/
  apps/
    web/          ← Next.js 15 frontend (port 3000)
    api/          ← FastAPI backend (port 8000)
  packages/
    shared/       ← shared TypeScript types and constants
    prompts/      ← versioned prompt templates (.md files)
      hu/         ← Hungarian prompts (primary)
      en/         ← English prompts
  infra/
    docker/
  docs/
  scripts/
  turbo.json
  pnpm-workspace.yaml
  docker-compose.yml
  .env.example
  CLAUDE.md
```

Docker Compose services (MVP):

- `web` — Next.js frontend
- `api` — FastAPI backend
- `worker` — RQ background worker (same image as api)
- `postgres` — PostgreSQL 16 + pgvector
- `redis` — Redis 7 (job queue)
- `ollama` — Ollama local LLM runtime

Note: Qdrant is NOT in the MVP Docker Compose. pgvector handles vector search. Qdrant is an optional upgrade path in V2 if retrieval latency or corpus size demands it.

## Finalized tech decisions (2026-06-08)

| Decision | Choice | Notes |
| --- | --- | --- |
| Agent orchestration | **PydanticAI** (not LangGraph) | Type-safe, no LangChain dep, easier to test |
| Vector search | **pgvector** (not Qdrant) | Built into PostgreSQL, sufficient for MVP/V1 |
| AI provider abstraction | **LiteLLM** | Unified interface for Ollama + Gemini + OpenRouter |
| Monorepo | **Turborepo + pnpm** | `turbo dev` starts everything |
| Background jobs | **RQ** (not Celery) | Simpler, Redis already required |
| Auth (MVP) | **JWT + .env** | Single-user local app |
| Animation | **Framer Motion 11.x** | Integrated with shadcn/ui |
| Cloud reviewer | **Google AI Studio / Gemini** | Optional in MVP, default in V1 |

## Development philosophy

Always build in small vertical slices.

Do not start with a full BookNova-style full-book generator. First build the writing workspace and controlled scene-level AI.

Priority order:

1. data model
2. project/book/chapter/scene CRUD
3. Codex CRUD
4. manuscript editor
5. chapter/scene board
6. local AI connection
7. rewrite selected text
8. generate scene from beats
9. RAG from Codex
10. continuity checker
11. chapter automation
12. export

## MVP boundaries

The MVP must include:

- local app startup through Docker Compose (web, api, worker, postgres+pgvector, redis, ollama)
- Project / Book / Chapter / Scene entities
- Beat CRUD
- Character / Location / Worldbuilding Codex
- Character `aliases` field (name detection in manuscript)
- `ai_visible` boolean on all Codex entities (hide entry from AI context)
- CodexRelation table — CRUD only, no UI yet (V1)
- CodexProgression table — CRUD only, AI does not filter yet (V1)
- Snippet entity — basic CRUD
- StyleGuide entity
- basic Tiptap editor with autosave
- chapter and scene board
- JWT auth (single-user, .env credentials)
- Ollama connection via LiteLLM
- scene continuation (auto mode)
- selected-text rewrite
- Describe sensory rewriting — selection-triggered, 6 channels (Látás / Hang / Tapintás / Szag / Íz / Metaforák), result cards in AI panel, star to Snippet
- scene generation from beat list
- AI output saved as Revision (never auto-overwrites)
- manual approve/insert step
- scene and chapter summary
- Markdown export

The MVP must not include yet:

- full-book automatic generation
- collaboration
- payment system
- user teams
- mobile app
- advanced KDP formatting
- image generation
- public SaaS deployment
- complex permissions
- real-time multiplayer editing

## Coding rules

Use:

- TypeScript strict mode
- clear domain naming
- typed API contracts
- backend Pydantic schemas
- database migrations
- explicit status enums
- clean folder structure
- small reusable components
- no hardcoded model names
- no AI prompt hardcoding inside route handlers; use prompt template files or services

Avoid:

- giant components
- giant service files
- business logic in frontend components
- AI logic mixed with database CRUD
- untyped JSON blobs unless absolutely necessary
- adding features outside MVP without asking

## Required workflow before large changes

Before any large change, Claude Code should produce:

1. short implementation plan
2. affected files
3. data model impact
4. API impact
5. test plan
6. known risks

## Testing framework

**Development philosophy:** Feature + Test-Driven Development (FTDD) — every feature starts with a failing test.

Frontend (`apps/web`):

- **Vitest** + `@testing-library/react` — unit and component tests
- **MSW** (Mock Service Worker) — API mocking in component tests
- **Playwright** — E2E tests (runs on CI against local dev server)

Backend (`apps/api`):

- **pytest** + **httpx** + **pytest-asyncio** — async endpoint tests
- **pytest-mock** — service layer unit tests (mocked repositories)
- **SQLite** (`aiosqlite`) — local integration tests (non-pgvector)
- **GitHub Actions Postgres service** — full integration + pgvector tests on CI
- `@pytest.mark.postgres` — marks pgvector-dependent tests, skipped on SQLite

Pre-push hooks (Husky):

- type-check + lint + unit tests run locally before every push (~20–30s)
- broken pushes are blocked before reaching GitHub

CI pipeline (GitHub Actions on push to main):

- `ci-frontend` + `ci-backend` jobs run in parallel
- `e2e` job runs after both pass (Playwright, local dev server)
- `deploy` job runs only if E2E passes → Vercel + Cloud Run

Full CI/CD and testing documentation: `docs/13_ci_cd_and_testing.md`

## Testing expectations

Minimum test coverage for:

- data model relations
- API endpoint validation
- AI workflow input/output contracts
- export pipeline
- generation job state transitions
- Codex retrieval logic (pgvector, `@pytest.mark.postgres`)

## AI workflow principles

- Separate writer agent and reviewer agent.
- Never trust a single generation pass.
- Every generated scene should have:
  - source inputs
  - model name
  - prompt version
  - generated output
  - review status
  - user approval state
- Keep human-in-the-loop approval.
- Always save previous revisions before overwriting text.
- For Hungarian writing, prioritize natural dialogue, consistent tegezés/magázás, and avoiding English-like sentence structures.
- All AI calls go through the ModelRouter service — never call LiteLLM directly from route handlers.
- Prompt templates live in `packages/prompts/hu/` and `packages/prompts/en/` — never hardcode prompts in Python files.
- MVP uses direct LiteLLM calls; PydanticAI agents are introduced in V1.
- Only human-approved text and summaries update the persistent memory / pgvector index.

## Important product principle

This app is not a generic AI chat app.

It is a structured writing environment where AI is embedded into:

- Codex
- scenes
- chapters
- beats
- style guide
- timeline
- revision history
- continuity checks
