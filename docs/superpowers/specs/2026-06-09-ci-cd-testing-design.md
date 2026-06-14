# ForgeWriter AI — CI/CD & Testing Framework Design

**Date:** 2026-06-09
**Status:** Approved
**Session:** Brainstorming — CI/CD and testing framework finalization

---

## Summary

This document captures all finalized decisions for the CI/CD pipeline and testing framework for ForgeWriter AI. The development philosophy is **feature + test-driven development (FTDD)**: every feature begins with a failing test, and no code ships without passing tests and automated deployment gates.

---

## Context & Constraints

- **Team:** Solo developer + a few friends (~2–4 users total)
- **Usage:** 1–3 books/month — low traffic, cost-sensitive
- **Branch strategy:** Single branch (main) — no feature branches, no PRs
- **Development style:** Feature + TDD — tests written before or alongside implementation
- **Deployment targets:** Vercel (frontend) + GCP Cloud Run (backend)
- **Database:** Neon PostgreSQL free tier (pgvector supported)
- **Redis:** Upstash free tier (standard Redis protocol, sufficient for RQ)

---

## Architecture Decision: Deployment Stack

| Component | Service | Cost/month |
| --- | --- | --- |
| Frontend | Vercel (free tier) | $0 |
| Backend | GCP Cloud Run (scales to zero) | $0–3 |
| PostgreSQL | Neon free tier (pgvector ✓) | $0 |
| Redis | Upstash free tier (10k cmd/day, 256MB) | $0 |
| Container registry | Google Artifact Registry | ~$0.02 |
| **Total** | | **~$0–5/month** |

**Rationale:**
- Firebase Hosting rejected — not designed for Next.js SSR/App Router, requires Cloud Functions workaround
- Full GCP native (Cloud SQL + Memorystore) rejected — Memorystore minimum 1GB = ~$36/month alone
- Cloud SQL considered as upgrade path if Neon free tier auto-suspend causes latency issues

---

## Architecture Decision: Quality Gate

**Model:** Pre-push hooks (local) + CI gate (remote), deploy only on green.

**Rationale for pre-push over CI-only:**
Single branch development means no PRs to block. Without pre-push hooks, broken code reaches main before CI catches it. Pre-push hooks stop bad pushes locally with fast feedback (~20–30s), while CI runs the full suite before deploy.

```
git push
  ↓ [pre-push hook — ~20-30s]
  type-check + lint + unit tests
  if FAIL → push aborted locally
  ↓
GitHub (main branch)
  ↓ [GitHub Actions CI — ~2-4min]
  unit tests + integration tests + E2E
  if FAIL → deploy blocked, notification sent
  ↓
  Vercel deploy (frontend)
  Cloud Run deploy (backend)
```

---

## Architecture Decision: Testing Layers

### Layer 1 — Unit tests

| | Frontend | Backend |
| --- | --- | --- |
| Framework | Vitest | pytest + pytest-mock |
| DB | None (mocked) | None (mocked repositories) |
| When | Pre-push + CI | Pre-push + CI |
| Speed | ~5–15s | ~5–15s |

Pure business logic, no infrastructure dependencies. Backend service layer is tested with mocked repositories. Frontend components are tested in isolation with MSW-mocked API responses.

### Layer 2 — Integration tests

| | Frontend | Backend |
| --- | --- | --- |
| Framework | Vitest + MSW | pytest + httpx |
| DB (local) | N/A | SQLite (aiosqlite) |
| DB (CI) | N/A | GitHub Actions Postgres 16 service container |
| When | Pre-push + CI | CI only |
| Speed | ~10–20s | ~30–60s |

**Database strategy rationale:**
- SQLite locally: fast, no Docker required, handles all non-pgvector CRUD tests
- GitHub Actions Postgres service: free, starts in ~5s, supports pgvector extension, used for all integration tests on CI
- `@pytest.mark.postgres` marker: pgvector-dependent tests are skipped on SQLite, run on CI Postgres only
- Neon test branching: rejected — free tier branch limit + auto-suspend latency

### Layer 3 — E2E tests

| | |
| --- | --- |
| Framework | Playwright |
| Target | Locally started Next.js dev server + FastAPI (CI) |
| When | CI only (after unit + integration pass) |
| Speed | ~2–4min |

**Deployment target rationale:**
- Vercel preview URL (option B) rejected for single branch setup: E2E would run AFTER production deploy, defeating the quality gate purpose
- Local dev server (option A) chosen: blocks deploy if E2E fails, accurate enough for UI flow testing (editor, scene creation, AI panel, drag-and-drop)

---

## Architecture Decision: Pre-push Hooks

**Tool:** Husky (git hooks) + lint-staged (staged file processing)

**Pre-push hook sequence:**

```
1. Frontend (apps/web):
   - tsc --noEmit (TypeScript type-check)
   - eslint (lint)
   - vitest run (unit tests only)

2. Backend (apps/api):
   - ruff check (lint)
   - mypy (type-check)
   - pytest tests/unit/ -x (unit tests, stop on first failure)
```

`DATABASE_URL=sqlite+aiosqlite:///./test.db` is set automatically for local backend test runs.

---

## Architecture Decision: GitHub Actions CI Pipeline

**Structure:** Two parallel jobs (frontend + backend), then sequential deploy.

```yaml
# On push to main:
jobs:
  ci-frontend:    # type-check + lint + vitest (all tests)
  ci-backend:     # ruff + mypy + pytest (unit + integration, Postgres service)
  e2e:            # Playwright (needs ci-frontend + ci-backend)
  deploy:         # Vercel + Cloud Run (needs e2e)
```

**GitHub secrets required:**
- `GCP_PROJECT_ID`
- `GCP_SERVICE_ACCOUNT_KEY` (JSON, service account with Cloud Run Admin + Artifact Registry Writer)
- `CLOUD_RUN_SERVICE_NAME`
- `CLOUD_RUN_REGION`
- `NEON_DATABASE_URL` (for staging/smoke tests if needed later)

**Deploy flow:**
- Vercel: triggered automatically via Vercel GitHub integration (zero config)
- Cloud Run: Docker build → push to Artifact Registry → `gcloud run deploy`
- Auth: Service Account JSON key in MVP, Workload Identity Federation in V1

---

## Feature + TDD Workflow

Every feature follows this cycle:

```
1. Define the feature (what it does, inputs, outputs)
2. Write failing tests first:
   - backend: pytest unit test for the service method
   - frontend: Vitest test for the component or hook
3. Implement the minimum code to make tests pass
4. Refactor (keep tests green)
5. Write integration test (backend: API endpoint with DB)
6. git push → pre-push hook validates → CI validates → deploy
```

**Test naming convention:**
- Backend: `test_<method>_<scenario>` e.g. `test_create_scene_returns_scene_with_id`
- Frontend: `<ComponentName>.test.tsx` e.g. `SceneCard.test.tsx`
- E2E: `<feature>.spec.ts` e.g. `create-project.spec.ts`

---

## Directory Structure

```text
apps/
  web/
    src/
      __tests__/          ← shared test utilities, MSW handlers
      components/
        SceneCard/
          SceneCard.tsx
          SceneCard.test.tsx
      hooks/
        useScene/
          useScene.ts
          useScene.test.ts
    playwright/
      e2e/
        create-project.spec.ts
        scene-editor.spec.ts
        ai-rewrite.spec.ts
    vitest.config.ts
    playwright.config.ts

  api/
    tests/
      conftest.py          ← DB fixtures, client fixtures
      unit/
        test_scene_service.py
        test_codex_service.py
        test_model_router.py
      integration/
        test_scene_api.py
        test_codex_api.py
        test_export_api.py
      postgres/            ← @pytest.mark.postgres tests
        test_vector_search.py
        test_embedding_worker.py
    pytest.ini
```

---

## Open questions (resolved as of 2026-06-09)

- ~~GitHub vs GitLab~~ → **GitHub**
- ~~Vercel vs Firebase Hosting~~ → **Vercel**
- ~~GCP Cloud Run vs Railway vs Fly.io~~ → **Cloud Run** (Gemini ecosystem, free tier)
- ~~Cloud SQL vs Neon~~ → **Neon free tier** (MVP), Cloud SQL upgrade path
- ~~Memorystore vs Upstash~~ → **Upstash** (Memorystore minimum $36/month)
- ~~Testcontainers vs SQLite vs Neon branches~~ → **SQLite local + GitHub Actions Postgres service**
- ~~E2E against local server vs Vercel preview~~ → **Local dev server** (quality gate before deploy)
- ~~Pre-push hooks vs CI-only gate~~ → **Both** (hooks for fast local feedback, CI for full suite)
- ~~Playwright vs Cypress~~ → **Playwright**
- ~~Service Account JSON vs Workload Identity Federation~~ → **JSON key in MVP**, WIF in V1
