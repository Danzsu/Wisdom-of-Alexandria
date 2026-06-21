# 13 — CI/CD Pipeline és Testing Framework

> **Döntések dátuma:** 2026-06-09  
> **Teljes specifikáció:** `docs/superpowers/specs/2026-06-09-ci-cd-testing-design.md`

---

## Fejlesztési filozófia

**Feature + Test-Driven Development (FTDD):**

Minden feature egy failing teszttel kezdődik. Kód nem kerül production-be anélkül, hogy átment volna az automatizált minőségi kapukon.

```
1. feature definíció (mit csinál, mi a bemenete/kimenete)
2. failing teszt megírása (backend service vagy frontend komponens)
3. minimum implementáció a teszt zölddé tételéhez
4. refaktorálás (tesztek zöldek maradnak)
5. integrációs teszt megírása
6. git push → pre-push hook → CI → deploy
```

---

## Deployment stack

| Komponens | Szolgáltatás | Havi költség |
| --- | --- | --- |
| Frontend | Vercel (free tier) | $0 |
| Backend | GCP Cloud Run (scales to zero) | $0–3 |
| PostgreSQL | Neon free tier + pgvector | $0 |
| Redis | Upstash free tier | $0 |
| Container registry | Google Artifact Registry | ~$0.02 |
| **Összesen** | | **~$0–5/hó** |

---

## Tesztelési rétegek

### Réteg 1 — Unit tesztek

Tiszta üzleti logika, nincs infrastruktúra függőség.

**Frontend — Vitest**

```bash
pnpm add -D vitest @testing-library/react @testing-library/user-event \
  @vitejs/plugin-react jsdom @vitest/coverage-v8
```

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
```

**Backend — pytest + pytest-mock**

```bash
uv add --dev pytest pytest-asyncio pytest-mock pytest-cov
```

`apps/api/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
markers =
    unit: pure logic tests, no DB
    integration: tests that touch the database
    postgres: requires real PostgreSQL (pgvector), skipped on SQLite
```

---

### Réteg 2 — Integrációs tesztek

**Frontend — MSW (Mock Service Worker)**

API hívások mockolása komponens és hook teszteknél:

```bash
pnpm add -D msw
```

`apps/web/src/__tests__/handlers.ts`:

```ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/projects', () => {
    return HttpResponse.json([{ id: '1', title: 'Test Project' }])
  }),
]
```

**Backend — SQLite lokálisan, Postgres CI-n**

`apps/api/tests/conftest.py`:

```python
import os
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.base import Base

# SQLite lokálisan, Postgres CI-n (DATABASE_URL env var alapján)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "sqlite+aiosqlite:///./test.db"
)

IS_POSTGRES = TEST_DATABASE_URL.startswith("postgresql")

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(engine):
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
```

**pgvector tesztek — csak CI-n:**

```python
import pytest

@pytest.mark.postgres
async def test_codex_vector_search(client, db_session):
    # Ez csak GitHub Actions-ön fut, SQLite-on skip
    ...
```

`pytest.ini`-ben a skip logika automatikus a `IS_POSTGRES` flaggel vagy custom plugin-nel.

> **Őszinte lefedettségi megjegyzés (2026-06):** A `@pytest.mark.postgres`
> marker jelenleg **egyetlen tesztet sem** díszít, és a
> `tests/unit/test_alembic_roundtrip.py` szándékosan SQLite-ot kényszerít. Ennek
> következménye, hogy a **pgvector**-specifikus migrációs DDL (vektor oszlop +
> index) és minden Postgres-only kódág **lokálisan nincs lefuttatva** — ezeket
> kizárólag egy zöld CI-Postgres futás validálja. Egy zöld lokális (SQLite)
> futás tehát NEM bizonyítja, hogy a pgvector migráció vagy a Postgres-only
> útvonalak helyesek; ezek addig **bizonyítatlanok**, amíg a CI-Postgres tier le
> nem fut. (Lokálisan nem indítunk pgvectort.)

---

### Réteg 3 — E2E tesztek (Playwright)

```bash
pnpm add -D @playwright/test
npx playwright install
```

`apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './playwright/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

E2E tesztek helye: `apps/web/playwright/e2e/`

```
playwright/e2e/
  create-project.spec.ts     ← projekt létrehozás flow
  scene-editor.spec.ts       ← jelenet írás, autosave
  codex-crud.spec.ts         ← karakter / helyszín CRUD
  ai-rewrite.spec.ts         ← AI rewrite flow (mock AI)
  markdown-export.spec.ts    ← export flow
```

---

## Pre-push hooks (Husky)

```bash
pnpm add -D husky lint-staged
npx husky init
```

`.husky/pre-push`:

```bash
#!/bin/sh
set -e

echo "🔍 ForgeWriter pre-push checks..."

# Frontend checks
echo "→ Frontend: type-check..."
cd apps/web && tsc --noEmit

echo "→ Frontend: lint..."
pnpm --filter web lint

echo "→ Frontend: unit tests..."
pnpm --filter web test:unit

# Backend checks
echo "→ Backend: lint (ruff)..."
cd ../../apps/api && uv run ruff check .

echo "→ Backend: type-check (mypy)..."
uv run mypy app/

echo "→ Backend: unit tests..."
DATABASE_URL=sqlite+aiosqlite:///./test.db \
  uv run pytest tests/unit/ -x -q

echo "✅ All pre-push checks passed."
```

`package.json` a gyökérben:

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

---

## GitHub Actions CI Pipeline

### Teljes pipeline struktúra

```
push to main
  ├── ci-frontend (párhuzamos)
  │   type-check + lint + vitest (unit + integrációs)
  ├── ci-backend (párhuzamos)
  │   ruff + mypy + pytest (unit + integrációs, Postgres service)
  │   pytest postgres/ (pgvector tesztek)
  ↓ (mindkettő zöld)
  e2e
  │   Playwright (lokális Next.js dev server + FastAPI)
  ↓ (zöld)
  deploy
      Vercel (frontend) + Cloud Run (backend)
```

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]

jobs:
  ci-frontend:
    name: Frontend CI
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check
      - run: pnpm lint
      - run: pnpm test:run --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: frontend-coverage
          path: apps/web/coverage/

  ci-backend:
    name: Backend CI
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: forgewriter
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: forgewriter_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    defaults:
      run:
        working-directory: apps/api
    env:
      TEST_DATABASE_URL: postgresql+asyncpg://forgewriter:testpassword@localhost:5432/forgewriter_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - uses: astral-sh/setup-uv@v4
      - run: uv sync --dev
      - run: uv run ruff check .
      - run: uv run mypy app/
      - run: uv run pytest tests/unit/ tests/integration/ tests/postgres/ -v --cov=app --cov-report=xml
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: backend-coverage
          path: apps/api/coverage.xml

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [ci-frontend, ci-backend]
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: forgewriter
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: forgewriter_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      TEST_DATABASE_URL: postgresql+asyncpg://forgewriter:testpassword@localhost:5432/forgewriter_e2e
      NEXT_PUBLIC_API_URL: http://localhost:8000
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - uses: astral-sh/setup-uv@v4
      - run: pnpm install --frozen-lockfile
      - run: uv sync --dev
        working-directory: apps/api
      - run: npx playwright install --with-deps chromium
        working-directory: apps/web
      - name: Start FastAPI backend
        run: uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 &
        working-directory: apps/api
      - name: Start Next.js frontend
        run: pnpm dev &
        working-directory: apps/web
      - name: Wait for services
        run: |
          npx wait-on http://localhost:8000/health http://localhost:3000 --timeout 60000
      - name: Run Playwright
        run: pnpm playwright test
        working-directory: apps/web
        env:
          BASE_URL: http://localhost:3000
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: [e2e]
    steps:
      - uses: actions/checkout@v4

      # Backend deploy → Cloud Run
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SERVICE_ACCOUNT_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - name: Build and push Docker image
        run: |
          gcloud builds submit apps/api \
            --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/forgewriter-api:${{ github.sha }}
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ secrets.CLOUD_RUN_SERVICE_NAME }} \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/forgewriter-api:${{ github.sha }} \
            --region ${{ secrets.CLOUD_RUN_REGION }} \
            --platform managed \
            --allow-unauthenticated

      # Frontend deploy → Vercel (automatikus a Vercel GitHub integráción keresztül)
      # Vercel automatikusan deployol push-ra, itt csak megerősítjük a sikeres deploy-t
      - name: Confirm Vercel deployment
        run: echo "Frontend deployment handled by Vercel GitHub integration"
```

---

## Könyvtárstruktúra összefoglalva

```text
forgewriter-ai/
  .husky/
    pre-push              ← pre-push hook script
  .github/
    workflows/
      ci.yml              ← teljes CI/CD pipeline
  apps/
    web/
      src/
        __tests__/
          setup.ts        ← vitest global setup
          handlers.ts     ← MSW API mock handlers
          server.ts       ← MSW server setup
        components/
          SceneCard/
            SceneCard.tsx
            SceneCard.test.tsx
        hooks/
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
        conftest.py
        unit/
          test_scene_service.py
          test_codex_service.py
          test_model_router.py
          test_export_service.py
        integration/
          test_scene_api.py
          test_codex_api.py
          test_beats_api.py
          test_export_api.py
        postgres/
          test_vector_search.py
          test_embedding_worker.py
      pytest.ini
```

---

## GitHub Secrets beállítása

A GitHub repository Settings → Secrets and variables → Actions menüpontban:

| Secret neve | Leírás |
| --- | --- |
| `GCP_PROJECT_ID` | GCP projekt ID |
| `GCP_SERVICE_ACCOUNT_KEY` | Service account JSON (base64 vagy raw) |
| `CLOUD_RUN_SERVICE_NAME` | pl. `forgewriter-api` |
| `CLOUD_RUN_REGION` | pl. `europe-west1` |

**Service account szükséges szerepkörök:**
- Cloud Run Admin
- Artifact Registry Writer
- Cloud Build Service Account

---

## Hasznos parancsok

```bash
# Unit tesztek futtatása (pre-push-hoz hasonló)
pnpm --filter web test:unit
DATABASE_URL=sqlite+aiosqlite:///./test.db uv run pytest tests/unit/ -v

# Integrációs tesztek futtatása lokálisan (Docker Compose postgres kell)
docker compose up -d postgres
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/forgewriter_test \
  uv run pytest tests/integration/ tests/postgres/ -v

# E2E tesztek futtatása lokálisan
pnpm --filter web playwright test --ui

# Lefedettség riport
pnpm --filter web test:coverage
uv run pytest --cov=app --cov-report=html tests/

# Pre-push hook manuális futtatása
.husky/pre-push
```

---

## Tesztelési konvenciók

**Fájlnév konvenciók:**
- Frontend: `ComponentName.test.tsx`, `useHookName.test.ts`
- Backend unit: `test_<service_name>.py`
- Backend integrációs: `test_<endpoint_group>_api.py`
- E2E: `<feature-name>.spec.ts`

**Teszt névkonvenciók:**
- Backend: `test_<method>_<scenario>` → pl. `test_create_scene_returns_id`
- Frontend: `it('should <behavior> when <condition>')` → pl. `it('should show error when title is empty')`
- E2E: `test('<user story>')` → pl. `test('user can create a project and add a chapter')`

**Mit kell tesztelni:**
- Backend service metódusok (unit)
- FastAPI endpoint-ok státuszkód + response shape (integrációs)
- pgvector retrieval logika (postgres marker)
- React komponensek user interaction alapján (nem implementáció alapján)
- Teljes user flow-k (E2E): projekt létrehozás, jelenet írás, AI rewrite, export

**Mit NE tesztelj:**
- SQLAlchemy belső működése
- Pydantic validáció (már tesztelt a library-ban)
- Next.js routing (framework felelőssége)
- Trivial getter/setter logika
