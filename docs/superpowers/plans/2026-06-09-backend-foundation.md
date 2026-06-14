# ForgeWriter AI — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full Turborepo monorepo, FastAPI backend with all SQLAlchemy models, Alembic migration, JWT auth, and complete Project CRUD — establishing the pattern for every other resource.

**Architecture:** Turborepo + pnpm monorepo with `apps/api` (FastAPI) and `apps/web` (Next.js placeholder). Backend uses SQLAlchemy 2.0 async with `Mapped` types, Alembic for schema migrations, FastAPI dependency injection for auth + DB sessions, and a simple JWT single-user auth from `.env` credentials.

**Tech Stack:** Python 3.12, FastAPI 0.115, Pydantic v2, SQLAlchemy 2.0 async, Alembic, PostgreSQL 16 + pgvector, asyncpg, uv, pytest + pytest-asyncio + httpx, Docker Compose

**Scope note:** This is Plan 1 of 3. Plan 2 covers remaining CRUD endpoints (Book/Chapter/Scene/Beat/Codex/Snippet/StyleGuide). Plan 3 covers AI features (ModelRouter, Rewrite, Describe, GenerateScene, Export).

---

## File map

```
forgewriter-ai/                      ← repo root
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                     ← root scripts (prepare: husky)
├── docker-compose.yml
├── .env.example
├── .gitignore
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── alembic.ini
│   │   ├── alembic/
│   │   │   ├── env.py
│   │   │   └── versions/            ← migration files go here
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py              ← FastAPI app factory + lifespan
│   │   │   ├── core/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── config.py        ← pydantic-settings Settings
│   │   │   │   ├── security.py      ← JWT create/decode, password verify
│   │   │   │   └── deps.py          ← get_db, get_current_user
│   │   │   ├── db/
│   │   │   │   ├── __init__.py
│   │   │   │   └── session.py       ← engine + AsyncSessionLocal
│   │   │   ├── models/
│   │   │   │   ├── __init__.py      ← imports all models (needed by Alembic)
│   │   │   │   ├── base.py          ← Base, UUIDPrimaryKey, Timestamps mixins
│   │   │   │   ├── project.py
│   │   │   │   ├── book.py
│   │   │   │   ├── chapter.py
│   │   │   │   ├── scene.py
│   │   │   │   ├── beat.py
│   │   │   │   ├── character.py
│   │   │   │   ├── location.py
│   │   │   │   ├── worldbuilding.py
│   │   │   │   ├── codex_entry.py
│   │   │   │   ├── codex_relation.py
│   │   │   │   ├── codex_progression.py
│   │   │   │   ├── snippet.py
│   │   │   │   ├── style_guide.py
│   │   │   │   ├── generation_job.py
│   │   │   │   ├── revision.py
│   │   │   │   └── ai_comment.py
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py
│   │   │   │   └── project.py       ← ProjectCreate, ProjectUpdate, ProjectResponse
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   └── crud_project.py  ← create/get/list/update/delete
│   │   │   └── api/
│   │   │       ├── __init__.py
│   │   │       └── v1/
│   │   │           ├── __init__.py
│   │   │           ├── router.py    ← includes all sub-routers
│   │   │           ├── auth.py      ← POST /token
│   │   │           └── projects.py  ← Project CRUD endpoints
│   │   ├── tests/
│   │   │   ├── conftest.py
│   │   │   ├── unit/
│   │   │   │   └── test_crud_project.py
│   │   │   └── integration/
│   │   │       └── test_projects_api.py
│   │   └── pytest.ini
│   └── web/
│       └── .gitkeep                 ← placeholder until frontend plan
└── packages/
    ├── shared/
    │   └── package.json
    └── prompts/
        ├── hu/
        │   └── .gitkeep
        └── en/
            └── .gitkeep
```

---

## Task 1: Monorepo scaffold

**Files:**

- Create: `turbo.json`
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `apps/api/pyproject.toml`
- Create: `packages/shared/package.json`
- Create: `.gitignore`
- Create: `apps/web/.gitkeep`
- Create: `packages/prompts/hu/.gitkeep`
- Create: `packages/prompts/en/.gitkeep`

---

- [ ] **Step 1.1: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "type-check": {
      "outputs": []
    }
  }
}
```

- [ ] **Step 1.2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 1.3: Create root package.json**

```json
{
  "name": "forgewriter-ai",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "prepare": "husky"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "husky": "^9.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 1.4: Create apps/api/pyproject.toml**

```toml
[project]
name = "forgewriter-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "pydantic[email]>=2.7.0",
    "pydantic-settings>=2.3.0",
    "sqlalchemy[asyncio]>=2.0.30",
    "alembic>=1.13.0",
    "asyncpg>=0.29.0",
    "aiosqlite>=0.20.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.9",
    "litellm>=1.40.0",
    "redis>=5.0.0",
    "rq>=1.16.0",
    "httpx>=0.27.0",
]

[dependency-groups]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.23.0",
    "pytest-mock>=3.14.0",
    "pytest-cov>=5.0.0",
    "ruff>=0.5.0",
    "mypy>=1.10.0",
]

[tool.ruff]
target-version = "py312"
line-length = 100
select = ["E", "F", "I", "UP"]

[tool.mypy]
python_version = "3.12"
ignore_missing_imports = true

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

- [ ] **Step 1.5: Create packages/shared/package.json**

```json
{
  "name": "@forgewriter/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

- [ ] **Step 1.6: Create .gitignore**

```
# Python
__pycache__/
*.pyc
.venv/
*.egg-info/
.mypy_cache/
.ruff_cache/
.pytest_cache/
coverage.xml
htmlcov/
test.db

# Node
node_modules/
.next/
dist/
.turbo/

# Docker
.env
postgres_data/

# IDE
.vscode/
.idea/
```

- [ ] **Step 1.7: Create placeholder dirs**

```bash
mkdir -p apps/web packages/prompts/hu packages/prompts/en
touch apps/web/.gitkeep packages/prompts/hu/.gitkeep packages/prompts/en/.gitkeep
```

- [ ] **Step 1.8: Install root node dependencies**

```bash
pnpm install
```

Expected: `node_modules/.pnpm` created, no errors.

- [ ] **Step 1.9: Install Python dependencies (from apps/api)**

```bash
cd apps/api && uv sync
```

Expected: `.venv` created inside `apps/api`, all packages installed.

- [ ] **Step 1.10: Commit**

```bash
git add turbo.json pnpm-workspace.yaml package.json apps/api/pyproject.toml packages/ .gitignore
git commit -m "chore: init monorepo scaffold (turbo + pnpm + pyproject)"
```

---

## Task 2: FastAPI core + health endpoint

**Files:**

- Create: `apps/api/app/__init__.py`
- Create: `apps/api/app/main.py`
- Create: `apps/api/app/core/__init__.py`
- Create: `apps/api/app/core/config.py`
- Create: `apps/api/app/core/security.py`
- Create: `apps/api/app/core/deps.py`
- Create: `apps/api/app/db/__init__.py`
- Create: `apps/api/app/db/session.py`
- Create: `apps/api/app/api/__init__.py`
- Create: `apps/api/app/api/v1/__init__.py`
- Create: `apps/api/app/api/v1/router.py`
- Create: `apps/api/pytest.ini`
- Create: `apps/api/tests/__init__.py`
- Create: `apps/api/tests/conftest.py`
- Create: `apps/api/tests/integration/test_health.py`

---

- [ ] **Step 2.1: Write the failing test first**

`apps/api/tests/integration/test_health.py`:

```python
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

- [ ] **Step 2.2: Run test to verify it fails (no app yet)**

```bash
cd apps/api && uv run pytest tests/integration/test_health.py -v
```

Expected: `ERROR` — `conftest.py` not found or `client` fixture missing.

- [ ] **Step 2.3: Write core/config.py**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    database_url: str = "postgresql+asyncpg://forgewriter:forgewriter@localhost:5432/forgewriter"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    admin_username: str = "admin"
    admin_password: str = "changeme"
    allowed_origins: list[str] = ["http://localhost:3000"]
    ollama_base_url: str = "http://ollama:11434"
    default_local_model: str = "ollama/llama3.2"


settings = Settings()
```

- [ ] **Step 2.4: Write db/session.py**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)
```

- [ ] **Step 2.5: Write core/security.py**

```python
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": subject, "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        return payload.get("sub")
    except JWTError:
        return None
```

- [ ] **Step 2.6: Write core/deps.py**

```python
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import AsyncSessionLocal

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    subject = decode_token(token)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return subject
```

- [ ] **Step 2.7: Write api/v1/router.py (empty, will grow)**

```python
from fastapi import APIRouter

api_router = APIRouter()
```

- [ ] **Step 2.8: Write main.py**

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    yield
    await engine.dispose()


app = FastAPI(
    title="ForgeWriter AI API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}
```

- [ ] **Step 2.9: Write pytest.ini**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
markers =
    unit: pure logic, no DB
    integration: tests that use an HTTP client or DB
    postgres: requires real PostgreSQL + pgvector, skipped on SQLite
```

- [ ] **Step 2.10: Write tests/conftest.py**

```python
import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import AsyncSessionLocal
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "sqlite+aiosqlite:///./test.db"
)
IS_POSTGRES = TEST_DATABASE_URL.startswith("postgresql")


@pytest.fixture(scope="session")
async def engine_fixture():
    from app.models.base import Base  # noqa: F401
    import app.models  # noqa: F401 — register all models

    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture
async def db_session(engine_fixture):
    session_factory = async_sessionmaker(
        engine_fixture, expire_on_commit=False, class_=AsyncSession
    )
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session: AsyncSession):
    from app.core.deps import get_db

    app.dependency_overrides[get_db] = lambda: db_session

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
```

Also create empty `__init__.py` files:

```bash
touch apps/api/app/__init__.py
touch apps/api/app/core/__init__.py
touch apps/api/app/db/__init__.py
touch apps/api/app/api/__init__.py
touch apps/api/app/api/v1/__init__.py
touch apps/api/tests/__init__.py
touch apps/api/tests/unit/__init__.py
touch apps/api/tests/integration/__init__.py
```

- [ ] **Step 2.11: Run test to verify it passes**

```bash
cd apps/api && uv run pytest tests/integration/test_health.py -v
```

Expected: `PASSED test_health_returns_ok`

- [ ] **Step 2.12: Commit**

```bash
git add apps/api/
git commit -m "feat: FastAPI core — config, security, deps, health endpoint"
```

---

## Task 3: Docker Compose + .env.example + Dockerfile

**Files:**

- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `apps/api/Dockerfile`

---

- [ ] **Step 3.1: Create docker-compose.yml**

```yaml
services:
  api:
    build:
      context: apps/api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://forgewriter:forgewriter@postgres:5432/forgewriter
      REDIS_URL: redis://redis:6379
      SECRET_KEY: ${SECRET_KEY}
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-changeme}
      OLLAMA_BASE_URL: http://ollama:11434
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./apps/api:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  worker:
    build:
      context: apps/api
    environment:
      DATABASE_URL: postgresql+asyncpg://forgewriter:forgewriter@postgres:5432/forgewriter
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./apps/api:/app
    command: uv run python -m rq worker --url redis://redis:6379 default

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: forgewriter
      POSTGRES_PASSWORD: forgewriter
      POSTGRES_DB: forgewriter
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U forgewriter"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
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

- [ ] **Step 3.2: Create .env.example**

```bash
# Copy to .env and fill in values
SECRET_KEY=change-this-to-a-random-64-char-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

# Optional: override defaults
DATABASE_URL=postgresql+asyncpg://forgewriter:forgewriter@localhost:5432/forgewriter
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_LOCAL_MODEL=ollama/llama3.2
```

- [ ] **Step 3.3: Create apps/api/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml ./
RUN uv sync --no-dev

COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3.4: Verify Docker Compose starts (requires Docker)**

```bash
cp .env.example .env
docker compose up postgres redis -d
```

Expected: Both services healthy (check `docker compose ps`).

- [ ] **Step 3.5: Commit**

```bash
git add docker-compose.yml .env.example apps/api/Dockerfile
git commit -m "chore: Docker Compose (postgres+pgvector, redis, ollama, api, worker)"
```

---

## Task 4: SQLAlchemy models — all entities

**Files:**

- Create: `apps/api/app/models/base.py`
- Create: `apps/api/app/models/project.py`
- Create: `apps/api/app/models/book.py`
- Create: `apps/api/app/models/chapter.py`
- Create: `apps/api/app/models/scene.py`
- Create: `apps/api/app/models/beat.py`
- Create: `apps/api/app/models/character.py`
- Create: `apps/api/app/models/location.py`
- Create: `apps/api/app/models/worldbuilding.py`
- Create: `apps/api/app/models/codex_entry.py`
- Create: `apps/api/app/models/codex_relation.py`
- Create: `apps/api/app/models/codex_progression.py`
- Create: `apps/api/app/models/snippet.py`
- Create: `apps/api/app/models/style_guide.py`
- Create: `apps/api/app/models/generation_job.py`
- Create: `apps/api/app/models/revision.py`
- Create: `apps/api/app/models/ai_comment.py`
- Modify: `apps/api/app/models/__init__.py`

---

- [ ] **Step 4.1: Write models/base.py (mixins)**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPrimaryKey:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

- [ ] **Step 4.2: Write models/project.py**

```python
import uuid

from sqlalchemy import String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class Project(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "projects"

    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="hu")
    genre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    target_audience: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="planning"
    )
    # status: planning | drafting | revision | completed | archived
```

- [ ] **Step 4.3: Write models/book.py**

```python
import uuid

from sqlalchemy import Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class Book(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "books"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    series_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logline: Mapped[str | None] = mapped_column(Text, nullable=True)
    synopsis: Mapped[str | None] = mapped_column(Text, nullable=True)
    genre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="hu")
    target_word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="idea")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # status: idea | planning | outlining | drafting | reviewing | revising | final | archived
```

- [ ] **Step 4.4: Write models/chapter.py**

```python
import uuid

from sqlalchemy import Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class Chapter(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "chapters"

    book_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    chapter_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    chapter_conflict: Mapped[str | None] = mapped_column(Text, nullable=True)
    chapter_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="idea")
    target_word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # status: idea | outlined | drafting | drafted | reviewing | revised | final
```

- [ ] **Step 4.5: Write models/scene.py**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class Scene(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "scenes"

    chapter_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    book_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    pov_character_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    location_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    time_marker: Mapped[str | None] = mapped_column(String(200), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="idea")
    text_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    text_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    emotional_tone: Mapped[str | None] = mapped_column(String(200), nullable=True)
    scene_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    scene_conflict: Mapped[str | None] = mapped_column(Text, nullable=True)
    scene_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # status: idea | outlined | drafting | drafted | reviewing | revised | final
```

- [ ] **Step 4.6: Write models/beat.py**

```python
import uuid

from sqlalchemy import Integer, Text, Uuid
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ARRAY, String

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class Beat(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "beats"

    scene_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    conflict: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_reveal: Mapped[str | None] = mapped_column(Text, nullable=True)
    emotional_turn: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_characters: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    forbidden_outcomes: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
```

- [ ] **Step 4.7: Write models/character.py**

```python
import uuid

from sqlalchemy import Boolean, String, Text, Uuid
from sqlalchemy import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class Character(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "characters"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    aliases: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    role: Mapped[str | None] = mapped_column(String(200), nullable=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    long_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    motivation: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    fear: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_conflict: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_conflict: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    speech_patterns: Mapped[str | None] = mapped_column(Text, nullable=True)
    arc_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    backstory: Mapped[str | None] = mapped_column(Text, nullable=True)
    appearance: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    ai_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
```

- [ ] **Step 4.8: Write models/location.py**

```python
import uuid

from sqlalchemy import Boolean, String, Text, Uuid, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class Location(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "locations"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    aliases: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    type: Mapped[str | None] = mapped_column(String(200), nullable=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    long_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sensory_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    mood: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    associated_characters: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    ai_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
```

- [ ] **Step 4.9: Write models/worldbuilding.py**

```python
import uuid

from sqlalchemy import Boolean, String, Text, Uuid, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class WorldbuildingEntry(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "worldbuilding_entries"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    aliases: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="other")
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    contradictions_to_avoid: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_characters: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    related_locations: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    ai_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # category: magic_system | technology | organization | history | culture |
    #           politics | economy | religion | law | object | other
```

- [ ] **Step 4.10: Write models/codex_entry.py (search layer)**

```python
import uuid

from sqlalchemy import String, Text, Uuid, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class CodexEntry(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "codex_entries"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # entity_type: character | location | worldbuilding
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    embedding_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )
    # embedding_status: pending | indexed | outdated
```

- [ ] **Step 4.11: Write models/codex_relation.py**

```python
import uuid

from sqlalchemy import Boolean, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class CodexRelation(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "codex_relations"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # source_type: character | location | worldbuilding
    source_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    relation_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # relation_type: related | connected | requires | excludes | influences
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    auto_include_in_context: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
```

- [ ] **Step 4.12: Write models/codex_progression.py**

```python
import uuid

from sqlalchemy import Boolean, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class CodexProgression(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "codex_progressions"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    codex_entry_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # codex_entry_type: character | location | worldbuilding
    codex_entry_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_field: Mapped[str | None] = mapped_column(String(200), nullable=True)
    override_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    activation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # activation_type: after_scene | after_chapter | after_timeline_event
    activates_after_scene_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    activates_after_chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    activates_after_chapter_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_spoiler: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
```

- [ ] **Step 4.13: Write models/snippet.py**

```python
import uuid

from sqlalchemy import String, Text, Uuid, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class Snippet(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "snippets"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    book_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    scene_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False, default="note")
    # content_type: note | todo | saved_draft | research | idea | reference | describe_result
    source_sense: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # source_sense: sight | sound | touch | smell | taste | metaphor | emotional_atmosphere
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
```

- [ ] **Step 4.14: Write models/style_guide.py**

```python
import uuid

from sqlalchemy import String, Text, Uuid, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class StyleGuide(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "style_guides"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    book_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    narrative_pov: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tense: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tone: Mapped[str | None] = mapped_column(String(200), nullable=True)
    style_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    dialogue_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    hungarian_language_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    forbidden_phrases: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    preferred_phrases: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    examples_good: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    examples_bad: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
```

- [ ] **Step 4.15: Write models/generation_job.py**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class GenerationJob(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "generation_jobs"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    book_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    scene_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    job_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # job_type: brainstorm | rewrite | describe | quick_edit | expand | compress |
    #           scene_draft | chapter_plan | chapter_draft | continuity_check |
    #           style_polish | hungarian_polish | developmental_edit | export | embedding_refresh
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="queued")
    # status: queued | running | requires_review | completed | failed | cancelled | accepted | rejected
    model_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    input_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 4.16: Write models/revision.py**

```python
import uuid

from sqlalchemy import String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime, func
from datetime import datetime

from app.models.base import Base, UUIDPrimaryKey


class Revision(UUIDPrimaryKey, Base):
    __tablename__ = "revisions"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    revision_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # revision_type: manual_edit | ai_rewrite | ai_generation | ai_polish | restore | import
    before_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    generation_job_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
```

- [ ] **Step 4.17: Write models/ai_comment.py**

```python
import uuid

from sqlalchemy import String, Text, Uuid, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class AIComment(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "ai_comments"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    book_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    scene_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    target_entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    target_entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    comment_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # comment_type: continuity | lore_conflict | character_voice | style | hungarian_language |
    #               plot_logic | pacing | dialogue | show_dont_tell
    severity: Mapped[str] = mapped_column(String(50), nullable=False, default="info")
    # severity: info | warning | major | critical
    message: Mapped[str] = mapped_column(Text, nullable=False)
    suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_codex_entry_ids: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open")
    # status: open | accepted | dismissed | fixed
    generation_job_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
```

- [ ] **Step 4.18: Write models/__init__.py (registers all models with Alembic)**

```python
from app.models.base import Base  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.book import Book  # noqa: F401
from app.models.chapter import Chapter  # noqa: F401
from app.models.scene import Scene  # noqa: F401
from app.models.beat import Beat  # noqa: F401
from app.models.character import Character  # noqa: F401
from app.models.location import Location  # noqa: F401
from app.models.worldbuilding import WorldbuildingEntry  # noqa: F401
from app.models.codex_entry import CodexEntry  # noqa: F401
from app.models.codex_relation import CodexRelation  # noqa: F401
from app.models.codex_progression import CodexProgression  # noqa: F401
from app.models.snippet import Snippet  # noqa: F401
from app.models.style_guide import StyleGuide  # noqa: F401
from app.models.generation_job import GenerationJob  # noqa: F401
from app.models.revision import Revision  # noqa: F401
from app.models.ai_comment import AIComment  # noqa: F401
```

- [ ] **Step 4.19: Run the health test again to confirm imports still work**

```bash
cd apps/api && uv run pytest tests/integration/test_health.py -v
```

Expected: `PASSED` — models import without circular dependency errors.

- [ ] **Step 4.20: Commit**

```bash
git add apps/api/app/models/ apps/api/app/db/
git commit -m "feat: all SQLAlchemy 2.0 models (Project, Book, Chapter, Scene, Beat, Codex, AI)"
```

---

## Task 5: Alembic setup + initial migration

**Files:**

- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/alembic/__init__.py`

---

- [ ] **Step 5.1: Init Alembic**

```bash
cd apps/api && uv run alembic init alembic
```

Expected: `alembic/` directory created with `env.py`, `script.py.mako`, `versions/`.

- [ ] **Step 5.2: Replace alembic/env.py with async version**

```python
import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import settings and all models so Alembic can detect them
from app.core.config import settings
import app.models  # noqa: F401 — registers all models

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.models.base import Base
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 5.3: Generate initial migration (requires running Postgres)**

```bash
cd apps/api && docker compose -f ../../docker-compose.yml up postgres -d
uv run alembic revision --autogenerate -m "initial_schema"
```

Expected: `alembic/versions/XXXX_initial_schema.py` created with all 16 tables.

If Postgres is not running, use offline mode: `uv run alembic upgrade head --sql > schema.sql` to preview.

- [ ] **Step 5.4: Apply migration**

```bash
cd apps/api && uv run alembic upgrade head
```

Expected: All tables created, no errors.

- [ ] **Step 5.5: Commit**

```bash
git add apps/api/alembic/
git commit -m "feat: Alembic async setup + initial schema migration (all 16 tables)"
```

---

## Task 6: JWT auth endpoint

**Files:**

- Create: `apps/api/app/schemas/auth.py`
- Create: `apps/api/app/api/v1/auth.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_auth_api.py`

---

- [ ] **Step 6.1: Write the failing test first**

`apps/api/tests/integration/test_auth_api.py`:

```python
import pytest
from httpx import AsyncClient

from app.core.config import settings

pytestmark = pytest.mark.asyncio


async def test_login_with_valid_credentials_returns_token(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/token",
        data={"username": settings.admin_username, "password": settings.admin_password},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_with_wrong_password_returns_401(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/token",
        data={"username": settings.admin_username, "password": "wrongpassword"},
    )
    assert response.status_code == 401


async def test_protected_endpoint_without_token_returns_401(client: AsyncClient) -> None:
    response = await client.get("/api/v1/projects")
    assert response.status_code == 401
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
cd apps/api && uv run pytest tests/integration/test_auth_api.py -v
```

Expected: `FAILED` — `/api/v1/auth/token` returns 404 (route not registered yet).

- [ ] **Step 6.3: Write schemas/auth.py**

```python
from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str
```

- [ ] **Step 6.4: Write api/v1/auth.py**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.auth import Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/token", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends()) -> Token:
    is_valid = (
        form.username == settings.admin_username
        and form.password == settings.admin_password
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(
        access_token=create_access_token(subject=form.username),
        token_type="bearer",
    )
```

- [ ] **Step 6.5: Register auth router in api/v1/router.py**

```python
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router

api_router = APIRouter()
api_router.include_router(auth_router)
```

- [ ] **Step 6.6: Create schemas/__init__.py**

```bash
touch apps/api/app/schemas/__init__.py
touch apps/api/app/services/__init__.py
```

- [ ] **Step 6.7: Run tests to verify they pass**

```bash
cd apps/api && uv run pytest tests/integration/test_auth_api.py -v
```

Expected: All 3 tests `PASSED`.

- [ ] **Step 6.8: Commit**

```bash
git add apps/api/app/api/ apps/api/app/schemas/ apps/api/app/services/
git commit -m "feat: JWT auth — POST /api/v1/auth/token (single-user .env credentials)"
```

---

## Task 7: Project CRUD — schema + service + router + tests

This task establishes the full CRUD pattern that every other resource follows.

**Files:**

- Create: `apps/api/app/schemas/project.py`
- Create: `apps/api/app/services/crud_project.py`
- Create: `apps/api/app/api/v1/projects.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/unit/test_crud_project.py`
- Create: `apps/api/tests/integration/test_projects_api.py`

---

- [ ] **Step 7.1: Write the failing unit test first**

`apps/api/tests/unit/test_crud_project.py`:

```python
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services import crud_project

pytestmark = [pytest.mark.asyncio, pytest.mark.unit]


async def test_create_project_adds_and_returns_project() -> None:
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    data = ProjectCreate(title="My Novel", language="hu")
    result = await crud_project.create_project(db, data)

    db.add.assert_called_once()
    db.commit.assert_awaited_once()
    assert isinstance(result, Project)


async def test_update_project_sets_only_provided_fields() -> None:
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    project = Project(id=uuid.uuid4(), title="Old Title", language="hu", status="planning")
    update = ProjectUpdate(title="New Title")

    result = await crud_project.update_project(db, project, update)

    assert result.title == "New Title"
    assert result.language == "hu"  # unchanged
```

- [ ] **Step 7.2: Run unit test to verify it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_crud_project.py -v
```

Expected: `ImportError` — `crud_project` not found yet.

- [ ] **Step 7.3: Write schemas/project.py**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectBase(BaseModel):
    title: str
    description: str | None = None
    language: str = "hu"
    genre: str | None = None
    target_audience: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    language: str | None = None
    genre: str | None = None
    target_audience: str | None = None
    status: str | None = None


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 7.4: Write services/crud_project.py**

```python
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


async def create_project(db: AsyncSession, data: ProjectCreate) -> Project:
    project = Project(**data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_project(db: AsyncSession, project_id: uuid.UUID) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def list_projects(
    db: AsyncSession, limit: int = 20, offset: int = 0
) -> list[Project]:
    result = await db.execute(select(Project).offset(offset).limit(limit))
    return list(result.scalars().all())


async def update_project(
    db: AsyncSession, project: Project, data: ProjectUpdate
) -> Project:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project: Project) -> None:
    await db.delete(project)
    await db.commit()
```

- [ ] **Step 7.5: Run unit test to verify it passes**

```bash
cd apps/api && uv run pytest tests/unit/test_crud_project.py -v
```

Expected: Both tests `PASSED`.

- [ ] **Step 7.6: Write the failing integration test**

`apps/api/tests/integration/test_projects_api.py`:

```python
import pytest
from httpx import AsyncClient

from app.core.config import settings

pytestmark = pytest.mark.asyncio


async def _get_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/v1/auth/token",
        data={"username": settings.admin_username, "password": settings.admin_password},
    )
    return resp.json()["access_token"]


async def test_create_project_returns_201_with_id(client: AsyncClient) -> None:
    token = await _get_token(client)
    response = await client.post(
        "/api/v1/projects",
        json={"title": "Üvegváros", "language": "hu", "genre": "fantasy"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["title"] == "Üvegváros"
    assert data["status"] == "planning"


async def test_list_projects_returns_created_project(client: AsyncClient) -> None:
    token = await _get_token(client)
    await client.post(
        "/api/v1/projects",
        json={"title": "Tesztkönvy"},
        headers={"Authorization": f"Bearer {token}"},
    )
    response = await client.get(
        "/api/v1/projects", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


async def test_get_nonexistent_project_returns_404(client: AsyncClient) -> None:
    token = await _get_token(client)
    response = await client.get(
        "/api/v1/projects/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


async def test_patch_project_updates_title(client: AsyncClient) -> None:
    token = await _get_token(client)
    create_resp = await client.post(
        "/api/v1/projects",
        json={"title": "Eredeti cím"},
        headers={"Authorization": f"Bearer {token}"},
    )
    project_id = create_resp.json()["id"]

    response = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"title": "Megváltozott cím"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Megváltozott cím"


async def test_delete_project_returns_204(client: AsyncClient) -> None:
    token = await _get_token(client)
    create_resp = await client.post(
        "/api/v1/projects",
        json={"title": "Törlendő projekt"},
        headers={"Authorization": f"Bearer {token}"},
    )
    project_id = create_resp.json()["id"]

    response = await client.delete(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204
```

- [ ] **Step 7.7: Run integration test to verify it fails**

```bash
cd apps/api && uv run pytest tests/integration/test_projects_api.py -v
```

Expected: `FAILED` — `/api/v1/projects` returns 404 (not registered yet).

- [ ] **Step 7.8: Write api/v1/projects.py**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services import crud_project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[ProjectResponse]:
    return await crud_project.list_projects(db, limit=limit, offset=offset)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProjectResponse:
    return await crud_project.create_project(db, data)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProjectResponse:
    project = await crud_project.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProjectResponse:
    project = await crud_project.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await crud_project.update_project(db, project, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    project = await crud_project.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await crud_project.delete_project(db, project)
```

- [ ] **Step 7.9: Register projects router in router.py**

```python
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(projects_router)
```

- [ ] **Step 7.10: Run all tests**

```bash
cd apps/api && uv run pytest -v
```

Expected: All tests `PASSED` (health + auth + projects unit + projects integration).

- [ ] **Step 7.11: Run linter**

```bash
cd apps/api && uv run ruff check app/ tests/
```

Expected: No errors. Fix any flagged issues before committing.

- [ ] **Step 7.12: Commit**

```bash
git add apps/api/app/schemas/ apps/api/app/services/ apps/api/app/api/v1/
git commit -m "feat: Project CRUD — schema, service, router, unit+integration tests"
```

---

## Plan 2 preview (next plan)

After this plan is complete, Plan 2 covers all remaining CRUD resources following the exact same pattern:

- `Book` — `GET/POST /books`, `GET/PATCH/DELETE /books/{id}`, reorder
- `Chapter` — nested under book, plus reorder endpoint
- `Scene` — nested under chapter, plus `archived_at` soft-archive endpoint
- `Beat` — nested under scene, plus reorder endpoint
- `Character` / `Location` / `WorldbuildingEntry` — project-scoped Codex CRUD
- `CodexRelation` / `CodexProgression` — CRUD only (no AI logic yet)
- `Snippet` / `StyleGuide` — CRUD
- `GenerationJob` — `GET /{id}`, `POST /{id}/accept`, `POST /{id}/reject`

Each resource gets:
1. `app/schemas/<resource>.py` — Base, Create, Update, Response
2. `app/services/crud_<resource>.py` — create/get/list/update/delete
3. `app/api/v1/<resource>.py` — FastAPI router
4. `tests/unit/test_crud_<resource>.py`
5. `tests/integration/test_<resource>_api.py`

Plan 3 covers AI features: ModelRouter, Ollama/LiteLLM, rewrite, describe, generate-scene, scene-continuation, Revision workflow, summary endpoints, Markdown export.
