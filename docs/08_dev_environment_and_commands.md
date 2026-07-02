# 08 — Development Environment and Commands

## Purpose

This document defines how to run and develop the local/self-hosted AI novel-writing platform.

The app should be easy to run locally through Docker Compose.

## Target local architecture

> **⚠️ FRISSÍTVE 2026-06-08** — Qdrant kivéve, pgvector + Turborepo monorepo.

```txt
Next.js frontend    (Turborepo: apps/web)
FastAPI backend     (Turborepo: apps/api)
AI szolgáltatás     (Turborepo: apps/ai — külön FastAPI app, RAG/generálás)
RQ worker           (háttér-jobok: export, embedding-frissítés)
PostgreSQL + pgvector database
Redis + RQ queue
Ollama local LLM runtime
```

> A Docker Compose szolgáltatások (lentebb): `postgres`, `redis`, `ollama`, `api`, `ai`, `worker`, `web`. **Qdrant nincs** — a vektor-keresést a pgvector adja.

## Required local tools

Install:

- Node.js 20+
- Python 3.11+
- Docker Desktop
- Docker Compose
- **pnpm** (monorepo csomagkezelő)
- **Turborepo** (`pnpm add -g turbo`)
- Git
- Ollama
- Pandoc (DOCX/EPUB/PDF exporthoz)
- WeasyPrint (csak PDF-exporthoz; `apps/api` Python-függőség, pandoc `--pdf-engine`-je)

Optional:

- VS Code + Claude Code
- LM Studio (lokális modell teszteléshez)
- pgAdmin / DBeaver (DB vizualizáció)
- Neon CLI (`npx neon`)

## Suggested repository structure

```txt
forgewriter-ai/
  apps/
    web/                    ← Next.js 15
      src/
        app/
        components/
        features/
        lib/
        styles/
      package.json
    api/
      app/
        api/
        core/
        db/
        models/
        schemas/
        services/
        ai/
        workflows/
        workers/
      pyproject.toml
  packages/
    shared/
      src/
    prompts/
      brainstorm.v1.txt
      rewrite.v1.txt
      scene_writer.v1.txt
      continuity_checker.v1.txt
      hungarian_editor.v1.txt
  infra/
    docker/
    migrations/
  docs/
  scripts/
  docker-compose.yml
  .env.example
  README.md
  CLAUDE.md
```

## Environment variables

Create `.env` from `.env.example`.

```env
APP_ENV=development

WEB_PORT=3000
API_PORT=8000

DATABASE_URL=postgresql+psycopg://forgewriter:forgewriter@postgres:5432/forgewriter
REDIS_URL=redis://redis:6379/0
OLLAMA_BASE_URL=http://ollama:11434
DEFAULT_LOCAL_MODEL=gemma-or-qwen-12b-placeholder
DEFAULT_EMBEDDING_MODEL=placeholder

ENABLE_CLOUD_MODELS=false
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

EXPORT_DIR=/data/exports
```

## Docker Compose services

```yaml
services:
  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - api

  api:
    build: ./apps/api
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis

  ai:
    build: ./apps/ai
    ports:
      - "8100:8100"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
      - ollama

  worker:
    build: ./apps/api
    command: python -m app.workers.main
    env_file:
      - .env
    depends_on:
      - api
      - redis
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: forgewriter
      POSTGRES_PASSWORD: forgewriter
      POSTGRES_DB: forgewriter
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

volumes:
  postgres_data:
  ollama_data:
```

## First-time setup

```bash
git clone <repo-url>
cd forgewriter-ai
cp .env.example .env
docker compose up -d postgres redis ollama
pnpm install
```

## Start development

```bash
docker compose up
```

Frontend:

```bash
cd apps/web
pnpm dev
```

Backend:

```bash
cd apps/api
uvicorn app.main:app --reload --port 8000
```

Worker:

```bash
cd apps/api
python -m app.workers.main
```

## Database migrations

Use Alembic.

Create migration:

```bash
cd apps/api
alembic revision --autogenerate -m "create core tables"
```

Run migrations:

```bash
cd apps/api
alembic upgrade head
```

> **Compose alatt automatikus.** `docker compose up`-nál az `apps/api` konténer
> entrypointja (`apps/api/docker-entrypoint.sh`) az uvicorn indítása ELŐTT
> lefuttatja az `alembic upgrade head`-et (idempotens; hiba esetén hangosan,
> nem-nulla exittel elhal). Csak az api migrál — az `ai` + `worker`
> szolgáltatások az api healthcheckjére kapuznak, így sosem indulnak félig
> migrált séma ellen. A fenti kézi parancs compose-on kívüli fejlesztéshez kell.

Rollback:

```bash
cd apps/api
alembic downgrade -1
```

## Seed data (opt-in demo content)

A fresh install boots into an empty workspace. The demo seed fills it with a
small, browsable Hungarian sample (original demo content). It is **opt-in** —
nothing runs it automatically.

From the repo root:

```bash
uv run --directory apps/api python -m app.seed
```

Inside the running compose stack:

```bash
docker compose exec api uv run --no-sync python -m app.seed
```

The seed creates:

- one project ("Demó — A tenger emlékezete") + one book
- two chapters with three scenes (every scene has content + beats)
- three Codex entries: one character (with aliases), one location, one
  worldbuilding entry

**Idempotence guard:** if the database already contains *any* project (demo or
real), the seed no-ops with a message and touches nothing — safe to run twice.
Contract test: `apps/api/tests/integration/test_seed.py`.

## Ollama setup

Pull a local model manually:

```bash
ollama pull <model-name>
```

Check model list:

```bash
ollama list
```

Test local generation:

```bash
curl http://localhost:11434/api/generate \
  -d '{
    "model": "<model-name>",
    "prompt": "Írj egy rövid magyar fantasy jelenetet.",
    "stream": false
  }'
```

## API health checks

Backend:

```bash
curl http://localhost:8000/health
```

Database:

```bash
curl http://localhost:8000/health/db
```

Ollama through backend:

```bash
curl http://localhost:8000/api/v1/models/local/status
```

Provider health-ping (AI szolgáltatás, `:8001` — Ollama-elérhetőség provider-configból):

```bash
curl http://localhost:8001/api/v1/providers/<provider-id>/health
```

## Frontend commands

```bash
cd apps/web
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Backend commands

```bash
cd apps/api
ruff check .
ruff format .
pytest
pytest tests/test_ai_workflows.py
pytest tests/test_api_contracts.py
```

## Shared package commands

```bash
cd packages/shared
pnpm build
pnpm test
```

## Testing strategy

### Frontend

Use:

- Vitest
- React Testing Library
- Playwright later

Test:

- route rendering
- scene editor autosave
- AI review panel
- board drag/drop behavior
- Codex search

### Backend

Use:

- pytest
- httpx test client
- factory fixtures
- mock model provider

Test:

- CRUD endpoints
- database relations
- generation job lifecycle
- prompt rendering
- AI output parsing
- export pipeline

## Required test fixtures

Create fixtures for:

- demo project
- demo book
- demo chapter
- demo scene
- demo character
- demo location
- demo style guide
- mock AI response

## Worker jobs

Initial worker job types:

```txt
generate_scene
rewrite_text
check_continuity
refresh_embeddings
export_book
```

## pgvector collections

PostgreSQL táblák + pgvector index jelenti az embedding store-t:

```txt
codex_embeddings    ← Codex bejegyzések (karakterek, helyszínek, lore)
scene_summaries     ← Approvált jelenetek összefoglalói
chapter_summaries   ← Fejezet szintű összefoglalók
style_guides        ← Stílusjegyek embedding-je
```

Mező struktúra (SQLAlchemy model):

```python
project_id: UUID
entity_type: str   # "character", "location", "worldbuilding", "scene"
entity_id: UUID
title: str
tags: list[str]
embedding: Vector(1536)
```

## Export pipeline dependencies

A Markdown export natív Python (nincs külső függőség). A DOCX / EPUB / PDF a **pandoc** CLI-n keresztül megy — telepítsd lokálisan, vagy használd az `apps/api` Docker image-et (a Dockerfile telepíti). A PDF emellett **WeasyPrint** PDF-engine-t igényel (`pandoc --pdf-engine=weasyprint`); a WeasyPrint Python-függőségként szerepel az `apps/api/pyproject.toml`-ban, lokális PDF-hez tehát `pandoc` + `weasyprint` is kell.

DOCX:

```bash
pandoc manuscript.md -o manuscript.docx
```

EPUB:

```bash
pandoc manuscript.md -o manuscript.epub
```

PDF (WeasyPrint engine-nel):

```bash
pandoc manuscript.md -o manuscript.pdf --pdf-engine=weasyprint
```

## Useful local URLs

```txt
Frontend:     http://localhost:3000
Backend API:  http://localhost:8000
Backend docs: http://localhost:8000/docs
Ollama:       http://localhost:11434
pgAdmin:      http://localhost:5050  (ha futtatod)
```

## Recommended Claude Code workflow

When asking Claude Code to implement a feature, provide:

1. relevant docs file
2. exact feature
3. expected files
4. acceptance criteria
5. constraints

Example:

```txt
Use CLAUDE.md, 04_mvp_implementation_plan.md, and 05_data_model_and_api_contract.md.

Implement Project, Book, Chapter, and Scene CRUD in FastAPI with SQLAlchemy and Alembic.

Do not implement AI yet.
Create tests for all CRUD endpoints.
```

## MVP implementation command order

```txt
1. scaffold repo
2. create Docker Compose
3. create FastAPI app
4. create database models
5. create Alembic migrations
6. create seed script
7. create Next.js app shell
8. create project/book/chapter/scene UI
9. create Codex UI
10. add Tiptap editor
11. connect Ollama
12. add AI rewrite
13. add scene generation
14. add Markdown export
```

## Production/self-hosting notes

For a small private deployment:

- use a single GPU VM if local inference is needed
- use PostgreSQL managed database or local container
- add backups for Postgres and export directory
- do not expose Ollama publicly
- protect API with authentication before remote deployment

## Backup strategy

Minimum local backup:

```txt
PostgreSQL dump (tartalmazza a pgvector adatokat is)
exports folder
uploaded assets folder
.env excluded from backup unless encrypted
```

## Security notes

- Never log API keys.
- Never expose model provider secrets to frontend.
- Do not send manuscript text to cloud models unless user explicitly enables cloud review.
- Mark cloud-routed generation jobs visibly in UI.
- Store model provider settings securely.
