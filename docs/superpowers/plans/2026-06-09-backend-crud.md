# ForgeWriter AI — Backend CRUD Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all remaining CRUD endpoints (Book, Chapter, Scene, Beat, Character, Location, WorldbuildingEntry, CodexRelation, CodexProgression, Snippet, StyleGuide, GenerationJob) following the pattern established in Plan 1's Project CRUD.

**Architecture:** Each resource gets a Pydantic schema file, a service file (async SQLAlchemy queries), a FastAPI router, and unit + integration tests. All routers are registered in `app/api/v1/router.py`. No business logic in routers — routers only call services.

**Prerequisite:** Plan 1 must be complete. All 16 SQLAlchemy models and JWT auth are in place.

**Tech Stack:** FastAPI 0.115, Pydantic v2, SQLAlchemy 2.0 async, pytest + httpx

---

## File map (new files only)

```
apps/api/app/
  schemas/
    book.py
    chapter.py
    scene.py
    beat.py
    character.py
    location.py
    worldbuilding.py
    codex_relation.py
    codex_progression.py
    snippet.py
    style_guide.py
    generation_job.py
  services/
    crud_book.py
    crud_chapter.py
    crud_scene.py
    crud_beat.py
    crud_character.py
    crud_location.py
    crud_worldbuilding.py
    crud_codex_relation.py
    crud_codex_progression.py
    crud_snippet.py
    crud_style_guide.py
    crud_generation_job.py
  api/v1/
    books.py
    chapters.py
    scenes.py
    beats.py
    characters.py
    locations.py
    worldbuilding.py
    codex_relations.py
    codex_progressions.py
    snippets.py
    style_guides.py
    generation_jobs.py
    router.py              ← modified each task to add new router
tests/
  unit/
    test_crud_book.py
    test_crud_scene.py
    test_crud_character.py
  integration/
    test_books_api.py
    test_chapters_api.py
    test_scenes_api.py
    test_beats_api.py
    test_characters_api.py
    test_codex_api.py
```

---

## Helper: auth token fixture

Add this to `tests/conftest.py` (modify the existing file):

```python
@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    from app.core.config import settings
    resp = await client.post(
        "/api/v1/auth/token",
        data={"username": settings.admin_username, "password": settings.admin_password},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

---

## Task 1: Book CRUD

**Files:**
- Create: `apps/api/app/schemas/book.py`
- Create: `apps/api/app/services/crud_book.py`
- Create: `apps/api/app/api/v1/books.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/unit/test_crud_book.py`
- Create: `apps/api/tests/integration/test_books_api.py`

---

- [ ] **Step 1.1: Write failing integration test**

`apps/api/tests/integration/test_books_api.py`:

```python
import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _create_project(client: AsyncClient, headers: dict) -> str:
    resp = await client.post(
        "/api/v1/projects", json={"title": "Test Project"}, headers=headers
    )
    return resp.json()["id"]


async def test_create_book_returns_201(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Üvegváros", "language": "hu", "genre": "fantasy"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Üvegváros"
    assert data["project_id"] == project_id
    assert data["status"] == "idea"


async def test_list_books_returns_created_book(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Könyv 1"},
        headers=auth_headers,
    )
    response = await client.get(
        f"/api/v1/projects/{project_id}/books", headers=auth_headers
    )
    assert response.status_code == 200
    assert len(response.json()) >= 1


async def test_patch_book_updates_status(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(client, auth_headers)
    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Tesztkönvy"},
        headers=auth_headers,
    )
    book_id = create_resp.json()["id"]
    response = await client.patch(
        f"/api/v1/books/{book_id}",
        json={"status": "drafting"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "drafting"
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
cd apps/api && uv run pytest tests/integration/test_books_api.py -v
```

Expected: `FAILED` — 404 on `/api/v1/projects/{id}/books`.

- [ ] **Step 1.3: Write schemas/book.py**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BookCreate(BaseModel):
    title: str
    subtitle: str | None = None
    logline: str | None = None
    synopsis: str | None = None
    genre: str | None = None
    language: str = "hu"
    target_word_count: int | None = None


class BookUpdate(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    logline: str | None = None
    synopsis: str | None = None
    genre: str | None = None
    language: str | None = None
    target_word_count: int | None = None
    status: str | None = None
    order_index: int | None = None


class BookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    series_id: uuid.UUID | None
    title: str
    subtitle: str | None
    logline: str | None
    synopsis: str | None
    genre: str | None
    language: str
    target_word_count: int | None
    current_word_count: int
    status: str
    order_index: int
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 1.4: Write services/crud_book.py**

```python
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.schemas.book import BookCreate, BookUpdate


async def create_book(db: AsyncSession, project_id: uuid.UUID, data: BookCreate) -> Book:
    book = Book(project_id=project_id, **data.model_dump())
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return book


async def get_book(db: AsyncSession, book_id: uuid.UUID) -> Book | None:
    result = await db.execute(select(Book).where(Book.id == book_id))
    return result.scalar_one_or_none()


async def list_books(
    db: AsyncSession, project_id: uuid.UUID, limit: int = 50, offset: int = 0
) -> list[Book]:
    result = await db.execute(
        select(Book)
        .where(Book.project_id == project_id)
        .order_by(Book.order_index)
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_book(db: AsyncSession, book: Book, data: BookUpdate) -> Book:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(book, field, value)
    await db.commit()
    await db.refresh(book)
    return book


async def delete_book(db: AsyncSession, book: Book) -> None:
    await db.delete(book)
    await db.commit()
```

- [ ] **Step 1.5: Write api/v1/books.py**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.book import BookCreate, BookResponse, BookUpdate
from app.services import crud_book

router = APIRouter(tags=["books"])


@router.get("/projects/{project_id}/books", response_model=list[BookResponse])
async def list_books(
    project_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[BookResponse]:
    return await crud_book.list_books(db, project_id, limit=limit, offset=offset)


@router.post(
    "/projects/{project_id}/books",
    response_model=BookResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_book(
    project_id: uuid.UUID,
    data: BookCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BookResponse:
    return await crud_book.create_book(db, project_id, data)


@router.get("/books/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BookResponse:
    book = await crud_book.get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return book


@router.patch("/books/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: uuid.UUID,
    data: BookUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BookResponse:
    book = await crud_book.get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return await crud_book.update_book(db, book, data)


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    book = await crud_book.get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    await crud_book.delete_book(db, book)
```

- [ ] **Step 1.6: Register router in api/v1/router.py**

```python
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.books import router as books_router
from app.api.v1.projects import router as projects_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(books_router)
```

- [ ] **Step 1.7: Run tests**

```bash
cd apps/api && uv run pytest tests/integration/test_books_api.py -v
```

Expected: All 3 tests `PASSED`.

- [ ] **Step 1.8: Commit**

```bash
git add apps/api/app/schemas/book.py apps/api/app/services/crud_book.py \
  apps/api/app/api/v1/books.py apps/api/app/api/v1/router.py \
  apps/api/tests/integration/test_books_api.py
git commit -m "feat: Book CRUD — schema, service, router, integration tests"
```

---

## Task 2: Chapter CRUD + reorder

**Files:**
- Create: `apps/api/app/schemas/chapter.py`
- Create: `apps/api/app/services/crud_chapter.py`
- Create: `apps/api/app/api/v1/chapters.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_chapters_api.py`

---

- [ ] **Step 2.1: Write failing integration test**

`apps/api/tests/integration/test_chapters_api.py`:

```python
import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _setup(client: AsyncClient, headers: dict) -> tuple[str, str]:
    """Returns (project_id, book_id)"""
    proj = await client.post(
        "/api/v1/projects", json={"title": "Test"}, headers=headers
    )
    book = await client.post(
        f"/api/v1/projects/{proj.json()['id']}/books",
        json={"title": "Könyv"},
        headers=headers,
    )
    return proj.json()["id"], book.json()["id"]


async def test_create_chapter_returns_201(client: AsyncClient, auth_headers: dict) -> None:
    _, book_id = await _setup(client, auth_headers)
    response = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": "1. fejezet", "chapter_goal": "Megismerjük a főhőst"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["title"] == "1. fejezet"


async def test_reorder_chapters(client: AsyncClient, auth_headers: dict) -> None:
    _, book_id = await _setup(client, auth_headers)
    ch1 = (
        await client.post(
            f"/api/v1/books/{book_id}/chapters",
            json={"title": "Első"},
            headers=auth_headers,
        )
    ).json()["id"]
    ch2 = (
        await client.post(
            f"/api/v1/books/{book_id}/chapters",
            json={"title": "Második"},
            headers=auth_headers,
        )
    ).json()["id"]
    response = await client.post(
        f"/api/v1/books/{book_id}/chapters/reorder",
        json={"chapter_ids": [ch2, ch1]},
        headers=auth_headers,
    )
    assert response.status_code == 200
    chapters = (
        await client.get(f"/api/v1/books/{book_id}/chapters", headers=auth_headers)
    ).json()
    assert chapters[0]["id"] == ch2
    assert chapters[1]["id"] == ch1
```

- [ ] **Step 2.2: Run test to confirm it fails**

```bash
cd apps/api && uv run pytest tests/integration/test_chapters_api.py -v
```

Expected: `FAILED` — 404.

- [ ] **Step 2.3: Write schemas/chapter.py**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChapterCreate(BaseModel):
    title: str
    summary: str | None = None
    chapter_goal: str | None = None
    chapter_conflict: str | None = None
    chapter_outcome: str | None = None
    target_word_count: int | None = None


class ChapterUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    chapter_goal: str | None = None
    chapter_conflict: str | None = None
    chapter_outcome: str | None = None
    target_word_count: int | None = None
    current_word_count: int | None = None
    status: str | None = None
    order_index: int | None = None


class ChapterReorder(BaseModel):
    chapter_ids: list[uuid.UUID]


class ChapterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    book_id: uuid.UUID
    title: str
    summary: str | None
    chapter_goal: str | None
    chapter_conflict: str | None
    chapter_outcome: str | None
    order_index: int
    status: str
    target_word_count: int | None
    current_word_count: int
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2.4: Write services/crud_chapter.py**

```python
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter import Chapter
from app.schemas.chapter import ChapterCreate, ChapterUpdate


async def create_chapter(
    db: AsyncSession, book_id: uuid.UUID, data: ChapterCreate
) -> Chapter:
    existing = await db.execute(
        select(Chapter).where(Chapter.book_id == book_id).order_by(Chapter.order_index.desc())
    )
    last = existing.scalar_one_or_none()
    next_index = (last.order_index + 1) if last else 0

    chapter = Chapter(book_id=book_id, order_index=next_index, **data.model_dump())
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter


async def get_chapter(db: AsyncSession, chapter_id: uuid.UUID) -> Chapter | None:
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    return result.scalar_one_or_none()


async def list_chapters(
    db: AsyncSession, book_id: uuid.UUID, limit: int = 100, offset: int = 0
) -> list[Chapter]:
    result = await db.execute(
        select(Chapter)
        .where(Chapter.book_id == book_id)
        .order_by(Chapter.order_index)
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_chapter(
    db: AsyncSession, chapter: Chapter, data: ChapterUpdate
) -> Chapter:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(chapter, field, value)
    await db.commit()
    await db.refresh(chapter)
    return chapter


async def reorder_chapters(
    db: AsyncSession, book_id: uuid.UUID, chapter_ids: list[uuid.UUID]
) -> None:
    for index, chapter_id in enumerate(chapter_ids):
        await db.execute(
            update(Chapter)
            .where(Chapter.id == chapter_id, Chapter.book_id == book_id)
            .values(order_index=index)
        )
    await db.commit()


async def delete_chapter(db: AsyncSession, chapter: Chapter) -> None:
    await db.delete(chapter)
    await db.commit()
```

- [ ] **Step 2.5: Write api/v1/chapters.py**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.chapter import (
    ChapterCreate,
    ChapterReorder,
    ChapterResponse,
    ChapterUpdate,
)
from app.services import crud_chapter

router = APIRouter(tags=["chapters"])


@router.get("/books/{book_id}/chapters", response_model=list[ChapterResponse])
async def list_chapters(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[ChapterResponse]:
    return await crud_chapter.list_chapters(db, book_id)


@router.post(
    "/books/{book_id}/chapters",
    response_model=ChapterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_chapter(
    book_id: uuid.UUID,
    data: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ChapterResponse:
    return await crud_chapter.create_chapter(db, book_id, data)


@router.post("/books/{book_id}/chapters/reorder", response_model=list[ChapterResponse])
async def reorder_chapters(
    book_id: uuid.UUID,
    data: ChapterReorder,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[ChapterResponse]:
    await crud_chapter.reorder_chapters(db, book_id, data.chapter_ids)
    return await crud_chapter.list_chapters(db, book_id)


@router.get("/chapters/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(
    chapter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ChapterResponse:
    chapter = await crud_chapter.get_chapter(db, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.patch("/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: uuid.UUID,
    data: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ChapterResponse:
    chapter = await crud_chapter.get_chapter(db, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return await crud_chapter.update_chapter(db, chapter, data)


@router.delete("/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chapter(
    chapter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    chapter = await crud_chapter.get_chapter(db, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    await crud_chapter.delete_chapter(db, chapter)
```

- [ ] **Step 2.6: Register in router.py**

```python
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.books import router as books_router
from app.api.v1.chapters import router as chapters_router
from app.api.v1.projects import router as projects_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(books_router)
api_router.include_router(chapters_router)
```

- [ ] **Step 2.7: Run tests**

```bash
cd apps/api && uv run pytest tests/integration/test_chapters_api.py -v
```

Expected: All tests `PASSED`.

- [ ] **Step 2.8: Commit**

```bash
git add apps/api/app/schemas/chapter.py apps/api/app/services/crud_chapter.py \
  apps/api/app/api/v1/chapters.py apps/api/app/api/v1/router.py \
  apps/api/tests/integration/test_chapters_api.py
git commit -m "feat: Chapter CRUD + reorder endpoint"
```

---

## Task 3: Scene CRUD + reorder + soft archive

**Files:**
- Create: `apps/api/app/schemas/scene.py`
- Create: `apps/api/app/services/crud_scene.py`
- Create: `apps/api/app/api/v1/scenes.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_scenes_api.py`

---

- [ ] **Step 3.1: Write failing integration test**

`apps/api/tests/integration/test_scenes_api.py`:

```python
import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _setup(client: AsyncClient, headers: dict) -> tuple[str, str, str]:
    """Returns (project_id, book_id, chapter_id)"""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=headers)).json()
    book = (
        await client.post(
            f"/api/v1/projects/{proj['id']}/books", json={"title": "B"}, headers=headers
        )
    ).json()
    chapter = (
        await client.post(
            f"/api/v1/books/{book['id']}/chapters", json={"title": "C"}, headers=headers
        )
    ).json()
    return proj["id"], book["id"], chapter["id"]


async def test_create_scene_returns_201(client: AsyncClient, auth_headers: dict) -> None:
    project_id, book_id, chapter_id = await _setup(client, auth_headers)
    response = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={
            "title": "1.1 Bevezető jelenet",
            "scene_goal": "Bemutjuk Annát",
            "project_id": project_id,
            "book_id": book_id,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "1.1 Bevezető jelenet"
    assert data["status"] == "idea"


async def test_update_scene_text(client: AsyncClient, auth_headers: dict) -> None:
    project_id, book_id, chapter_id = await _setup(client, auth_headers)
    scene = (
        await client.post(
            f"/api/v1/chapters/{chapter_id}/scenes",
            json={"title": "Jelenet", "project_id": project_id, "book_id": book_id},
            headers=auth_headers,
        )
    ).json()
    response = await client.patch(
        f"/api/v1/scenes/{scene['id']}",
        json={"text_markdown": "Anna belépett a szobába.", "current_word_count": 4},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["text_markdown"] == "Anna belépett a szobába."


async def test_archive_scene(client: AsyncClient, auth_headers: dict) -> None:
    project_id, book_id, chapter_id = await _setup(client, auth_headers)
    scene = (
        await client.post(
            f"/api/v1/chapters/{chapter_id}/scenes",
            json={"title": "Archiválandó", "project_id": project_id, "book_id": book_id},
            headers=auth_headers,
        )
    ).json()
    response = await client.post(
        f"/api/v1/scenes/{scene['id']}/archive", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["archived_at"] is not None


async def test_reorder_scenes(client: AsyncClient, auth_headers: dict) -> None:
    project_id, book_id, chapter_id = await _setup(client, auth_headers)
    sc1 = (
        await client.post(
            f"/api/v1/chapters/{chapter_id}/scenes",
            json={"title": "A", "project_id": project_id, "book_id": book_id},
            headers=auth_headers,
        )
    ).json()["id"]
    sc2 = (
        await client.post(
            f"/api/v1/chapters/{chapter_id}/scenes",
            json={"title": "B", "project_id": project_id, "book_id": book_id},
            headers=auth_headers,
        )
    ).json()["id"]
    await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes/reorder",
        json={"scene_ids": [sc2, sc1]},
        headers=auth_headers,
    )
    scenes = (
        await client.get(f"/api/v1/chapters/{chapter_id}/scenes", headers=auth_headers)
    ).json()
    assert scenes[0]["id"] == sc2
```

- [ ] **Step 3.2: Run to confirm failure**

```bash
cd apps/api && uv run pytest tests/integration/test_scenes_api.py -v
```

Expected: `FAILED` — 404.

- [ ] **Step 3.3: Write schemas/scene.py**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SceneCreate(BaseModel):
    title: str
    project_id: uuid.UUID
    book_id: uuid.UUID
    summary: str | None = None
    pov_character_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    time_marker: str | None = None
    emotional_tone: str | None = None
    scene_goal: str | None = None
    scene_conflict: str | None = None
    scene_outcome: str | None = None


class SceneUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    pov_character_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    time_marker: str | None = None
    emotional_tone: str | None = None
    scene_goal: str | None = None
    scene_conflict: str | None = None
    scene_outcome: str | None = None
    status: str | None = None
    text_json: dict | None = None
    text_markdown: str | None = None
    current_word_count: int | None = None
    target_word_count: int | None = None
    order_index: int | None = None


class SceneReorder(BaseModel):
    scene_ids: list[uuid.UUID]


class SceneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chapter_id: uuid.UUID
    book_id: uuid.UUID
    project_id: uuid.UUID
    title: str
    summary: str | None
    pov_character_id: uuid.UUID | None
    location_id: uuid.UUID | None
    time_marker: str | None
    emotional_tone: str | None
    scene_goal: str | None
    scene_conflict: str | None
    scene_outcome: str | None
    order_index: int
    status: str
    text_json: dict | None
    text_markdown: str | None
    current_word_count: int
    target_word_count: int | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 3.4: Write services/crud_scene.py**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scene import Scene
from app.schemas.scene import SceneCreate, SceneUpdate


async def create_scene(
    db: AsyncSession, chapter_id: uuid.UUID, data: SceneCreate
) -> Scene:
    existing = await db.execute(
        select(Scene).where(Scene.chapter_id == chapter_id).order_by(Scene.order_index.desc())
    )
    last = existing.scalar_one_or_none()
    next_index = (last.order_index + 1) if last else 0

    scene = Scene(chapter_id=chapter_id, order_index=next_index, **data.model_dump())
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene


async def get_scene(db: AsyncSession, scene_id: uuid.UUID) -> Scene | None:
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    return result.scalar_one_or_none()


async def list_scenes(
    db: AsyncSession, chapter_id: uuid.UUID, include_archived: bool = False
) -> list[Scene]:
    q = select(Scene).where(Scene.chapter_id == chapter_id)
    if not include_archived:
        q = q.where(Scene.archived_at.is_(None))
    result = await db.execute(q.order_by(Scene.order_index))
    return list(result.scalars().all())


async def update_scene(db: AsyncSession, scene: Scene, data: SceneUpdate) -> Scene:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(scene, field, value)
    await db.commit()
    await db.refresh(scene)
    return scene


async def archive_scene(db: AsyncSession, scene: Scene) -> Scene:
    scene.archived_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(scene)
    return scene


async def reorder_scenes(
    db: AsyncSession, chapter_id: uuid.UUID, scene_ids: list[uuid.UUID]
) -> None:
    for index, scene_id in enumerate(scene_ids):
        await db.execute(
            update(Scene)
            .where(Scene.id == scene_id, Scene.chapter_id == chapter_id)
            .values(order_index=index)
        )
    await db.commit()


async def delete_scene(db: AsyncSession, scene: Scene) -> None:
    await db.delete(scene)
    await db.commit()
```

- [ ] **Step 3.5: Write api/v1/scenes.py**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.scene import SceneCreate, SceneReorder, SceneResponse, SceneUpdate
from app.services import crud_scene

router = APIRouter(tags=["scenes"])


@router.get("/chapters/{chapter_id}/scenes", response_model=list[SceneResponse])
async def list_scenes(
    chapter_id: uuid.UUID,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[SceneResponse]:
    return await crud_scene.list_scenes(db, chapter_id, include_archived=include_archived)


@router.post(
    "/chapters/{chapter_id}/scenes",
    response_model=SceneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_scene(
    chapter_id: uuid.UUID,
    data: SceneCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneResponse:
    return await crud_scene.create_scene(db, chapter_id, data)


@router.post("/chapters/{chapter_id}/scenes/reorder", response_model=list[SceneResponse])
async def reorder_scenes(
    chapter_id: uuid.UUID,
    data: SceneReorder,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[SceneResponse]:
    await crud_scene.reorder_scenes(db, chapter_id, data.scene_ids)
    return await crud_scene.list_scenes(db, chapter_id)


@router.get("/scenes/{scene_id}", response_model=SceneResponse)
async def get_scene(
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneResponse:
    scene = await crud_scene.get_scene(db, scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.patch("/scenes/{scene_id}", response_model=SceneResponse)
async def update_scene(
    scene_id: uuid.UUID,
    data: SceneUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneResponse:
    scene = await crud_scene.get_scene(db, scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    return await crud_scene.update_scene(db, scene, data)


@router.post("/scenes/{scene_id}/archive", response_model=SceneResponse)
async def archive_scene(
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneResponse:
    scene = await crud_scene.get_scene(db, scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    return await crud_scene.archive_scene(db, scene)


@router.delete("/scenes/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    scene = await crud_scene.get_scene(db, scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    await crud_scene.delete_scene(db, scene)
```

- [ ] **Step 3.6: Register in router.py**

```python
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.books import router as books_router
from app.api.v1.chapters import router as chapters_router
from app.api.v1.projects import router as projects_router
from app.api.v1.scenes import router as scenes_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(books_router)
api_router.include_router(chapters_router)
api_router.include_router(scenes_router)
```

- [ ] **Step 3.7: Run tests**

```bash
cd apps/api && uv run pytest tests/integration/test_scenes_api.py -v
```

Expected: All 4 tests `PASSED`.

- [ ] **Step 3.8: Commit**

```bash
git add apps/api/app/schemas/scene.py apps/api/app/services/crud_scene.py \
  apps/api/app/api/v1/scenes.py apps/api/app/api/v1/router.py \
  apps/api/tests/integration/test_scenes_api.py
git commit -m "feat: Scene CRUD + reorder + soft archive endpoint"
```

---

## Task 4: Beat CRUD + reorder

**Files:**
- Create: `apps/api/app/schemas/beat.py`
- Create: `apps/api/app/services/crud_beat.py`
- Create: `apps/api/app/api/v1/beats.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_beats_api.py`

---

- [ ] **Step 4.1: Write failing integration test**

`apps/api/tests/integration/test_beats_api.py`:

```python
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _setup(client, headers):
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=headers)).json()
    book = (
        await client.post(
            f"/api/v1/projects/{proj['id']}/books", json={"title": "B"}, headers=headers
        )
    ).json()
    chapter = (
        await client.post(
            f"/api/v1/books/{book['id']}/chapters", json={"title": "C"}, headers=headers
        )
    ).json()
    scene = (
        await client.post(
            f"/api/v1/chapters/{chapter['id']}/scenes",
            json={"title": "S", "project_id": proj["id"], "book_id": book["id"]},
            headers=headers,
        )
    ).json()
    return scene["id"]


async def test_create_beat_returns_201(client: AsyncClient, auth_headers: dict) -> None:
    scene_id = await _setup(client, auth_headers)
    response = await client.post(
        f"/api/v1/scenes/{scene_id}/beats",
        json={"goal": "Anna bemegy a házba", "conflict": "Az ajtó zárva van"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["goal"] == "Anna bemegy a házba"


async def test_reorder_beats(client: AsyncClient, auth_headers: dict) -> None:
    scene_id = await _setup(client, auth_headers)
    b1 = (
        await client.post(
            f"/api/v1/scenes/{scene_id}/beats",
            json={"goal": "Első beat"},
            headers=auth_headers,
        )
    ).json()["id"]
    b2 = (
        await client.post(
            f"/api/v1/scenes/{scene_id}/beats",
            json={"goal": "Második beat"},
            headers=auth_headers,
        )
    ).json()["id"]
    await client.post(
        f"/api/v1/scenes/{scene_id}/beats/reorder",
        json={"beat_ids": [b2, b1]},
        headers=auth_headers,
    )
    beats = (
        await client.get(f"/api/v1/scenes/{scene_id}/beats", headers=auth_headers)
    ).json()
    assert beats[0]["id"] == b2
```

- [ ] **Step 4.2: Run to confirm failure**

```bash
cd apps/api && uv run pytest tests/integration/test_beats_api.py -v
```

- [ ] **Step 4.3: Write schemas/beat.py**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BeatCreate(BaseModel):
    goal: str | None = None
    conflict: str | None = None
    key_reveal: str | None = None
    emotional_turn: str | None = None
    outcome: str | None = None
    required_characters: list[str] = []
    forbidden_outcomes: list[str] = []


class BeatUpdate(BaseModel):
    goal: str | None = None
    conflict: str | None = None
    key_reveal: str | None = None
    emotional_turn: str | None = None
    outcome: str | None = None
    required_characters: list[str] | None = None
    forbidden_outcomes: list[str] | None = None
    order_index: int | None = None


class BeatReorder(BaseModel):
    beat_ids: list[uuid.UUID]


class BeatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID
    order_index: int
    goal: str | None
    conflict: str | None
    key_reveal: str | None
    emotional_turn: str | None
    outcome: str | None
    required_characters: list[str]
    forbidden_outcomes: list[str]
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4.4: Write services/crud_beat.py**

```python
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beat import Beat
from app.schemas.beat import BeatCreate, BeatUpdate


async def create_beat(db: AsyncSession, scene_id: uuid.UUID, data: BeatCreate) -> Beat:
    existing = await db.execute(
        select(Beat).where(Beat.scene_id == scene_id).order_by(Beat.order_index.desc())
    )
    last = existing.scalar_one_or_none()
    next_index = (last.order_index + 1) if last else 0

    beat = Beat(scene_id=scene_id, order_index=next_index, **data.model_dump())
    db.add(beat)
    await db.commit()
    await db.refresh(beat)
    return beat


async def get_beat(db: AsyncSession, beat_id: uuid.UUID) -> Beat | None:
    result = await db.execute(select(Beat).where(Beat.id == beat_id))
    return result.scalar_one_or_none()


async def list_beats(db: AsyncSession, scene_id: uuid.UUID) -> list[Beat]:
    result = await db.execute(
        select(Beat).where(Beat.scene_id == scene_id).order_by(Beat.order_index)
    )
    return list(result.scalars().all())


async def update_beat(db: AsyncSession, beat: Beat, data: BeatUpdate) -> Beat:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(beat, field, value)
    await db.commit()
    await db.refresh(beat)
    return beat


async def reorder_beats(
    db: AsyncSession, scene_id: uuid.UUID, beat_ids: list[uuid.UUID]
) -> None:
    for index, beat_id in enumerate(beat_ids):
        await db.execute(
            update(Beat)
            .where(Beat.id == beat_id, Beat.scene_id == scene_id)
            .values(order_index=index)
        )
    await db.commit()


async def delete_beat(db: AsyncSession, beat: Beat) -> None:
    await db.delete(beat)
    await db.commit()
```

- [ ] **Step 4.5: Write api/v1/beats.py**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.beat import BeatCreate, BeatReorder, BeatResponse, BeatUpdate
from app.services import crud_beat

router = APIRouter(tags=["beats"])


@router.get("/scenes/{scene_id}/beats", response_model=list[BeatResponse])
async def list_beats(
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[BeatResponse]:
    return await crud_beat.list_beats(db, scene_id)


@router.post(
    "/scenes/{scene_id}/beats",
    response_model=BeatResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_beat(
    scene_id: uuid.UUID,
    data: BeatCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BeatResponse:
    return await crud_beat.create_beat(db, scene_id, data)


@router.post("/scenes/{scene_id}/beats/reorder", response_model=list[BeatResponse])
async def reorder_beats(
    scene_id: uuid.UUID,
    data: BeatReorder,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[BeatResponse]:
    await crud_beat.reorder_beats(db, scene_id, data.beat_ids)
    return await crud_beat.list_beats(db, scene_id)


@router.patch("/beats/{beat_id}", response_model=BeatResponse)
async def update_beat(
    beat_id: uuid.UUID,
    data: BeatUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BeatResponse:
    beat = await crud_beat.get_beat(db, beat_id)
    if beat is None:
        raise HTTPException(status_code=404, detail="Beat not found")
    return await crud_beat.update_beat(db, beat, data)


@router.delete("/beats/{beat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_beat(
    beat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    beat = await crud_beat.get_beat(db, beat_id)
    if beat is None:
        raise HTTPException(status_code=404, detail="Beat not found")
    await crud_beat.delete_beat(db, beat)
```

- [ ] **Step 4.6: Register in router.py**

```python
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.beats import router as beats_router
from app.api.v1.books import router as books_router
from app.api.v1.chapters import router as chapters_router
from app.api.v1.projects import router as projects_router
from app.api.v1.scenes import router as scenes_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(books_router)
api_router.include_router(chapters_router)
api_router.include_router(scenes_router)
api_router.include_router(beats_router)
```

- [ ] **Step 4.7: Run tests and commit**

```bash
cd apps/api && uv run pytest tests/integration/test_beats_api.py -v
git add apps/api/app/schemas/beat.py apps/api/app/services/crud_beat.py \
  apps/api/app/api/v1/beats.py apps/api/app/api/v1/router.py \
  apps/api/tests/integration/test_beats_api.py
git commit -m "feat: Beat CRUD + reorder endpoint"
```

---

## Task 5: Codex CRUD — Character, Location, WorldbuildingEntry

These three share identical CRUD shape. All three are project-scoped. Character is shown in full; Location and WorldbuildingEntry follow the same pattern.

**Files:**
- Create: `apps/api/app/schemas/character.py`
- Create: `apps/api/app/schemas/location.py`
- Create: `apps/api/app/schemas/worldbuilding.py`
- Create: `apps/api/app/services/crud_character.py`
- Create: `apps/api/app/services/crud_location.py`
- Create: `apps/api/app/services/crud_worldbuilding.py`
- Create: `apps/api/app/api/v1/characters.py`
- Create: `apps/api/app/api/v1/locations.py`
- Create: `apps/api/app/api/v1/worldbuilding.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_codex_api.py`

---

- [ ] **Step 5.1: Write failing integration test**

`apps/api/tests/integration/test_codex_api.py`:

```python
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _project(client, headers):
    return (
        await client.post("/api/v1/projects", json={"title": "P"}, headers=headers)
    ).json()["id"]


async def test_create_character_returns_201(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _project(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Anna Kovács", "aliases": ["Anna", "Kovács Anna"], "role": "protagonist"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Anna Kovács"
    assert "Anna" in data["aliases"]
    assert data["ai_visible"] is True


async def test_character_ai_visible_toggle(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _project(client, auth_headers)
    char = (
        await client.post(
            f"/api/v1/projects/{project_id}/characters",
            json={"name": "Titkos szereplő"},
            headers=auth_headers,
        )
    ).json()
    response = await client.patch(
        f"/api/v1/characters/{char['id']}",
        json={"ai_visible": False},
        headers=auth_headers,
    )
    assert response.json()["ai_visible"] is False


async def test_create_location_returns_201(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _project(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/locations",
        json={"name": "Üvegvár", "aliases": ["A vár"], "mood": "fenyegető"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Üvegvár"


async def test_create_worldbuilding_entry(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _project(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/worldbuilding",
        json={"title": "A Káosz Mágiája", "category": "magic_system"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["category"] == "magic_system"
```

- [ ] **Step 5.2: Run to confirm failure**

```bash
cd apps/api && uv run pytest tests/integration/test_codex_api.py -v
```

- [ ] **Step 5.3: Write schemas/character.py**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CharacterCreate(BaseModel):
    name: str
    aliases: list[str] = []
    role: str | None = None
    short_description: str | None = None
    long_description: str | None = None
    motivation: str | None = None
    goal: str | None = None
    fear: str | None = None
    internal_conflict: str | None = None
    external_conflict: str | None = None
    voice_notes: str | None = None
    speech_patterns: str | None = None
    arc_summary: str | None = None
    backstory: str | None = None
    appearance: str | None = None
    tags: list[str] = []
    ai_visible: bool = True


class CharacterUpdate(BaseModel):
    name: str | None = None
    aliases: list[str] | None = None
    role: str | None = None
    short_description: str | None = None
    long_description: str | None = None
    motivation: str | None = None
    goal: str | None = None
    fear: str | None = None
    internal_conflict: str | None = None
    external_conflict: str | None = None
    voice_notes: str | None = None
    speech_patterns: str | None = None
    arc_summary: str | None = None
    backstory: str | None = None
    appearance: str | None = None
    tags: list[str] | None = None
    ai_visible: bool | None = None


class CharacterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    aliases: list[str]
    role: str | None
    short_description: str | None
    long_description: str | None
    motivation: str | None
    goal: str | None
    fear: str | None
    internal_conflict: str | None
    external_conflict: str | None
    voice_notes: str | None
    speech_patterns: str | None
    arc_summary: str | None
    backstory: str | None
    appearance: str | None
    tags: list[str]
    ai_visible: bool
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 5.4: Write schemas/location.py**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class LocationCreate(BaseModel):
    name: str
    aliases: list[str] = []
    type: str | None = None
    short_description: str | None = None
    long_description: str | None = None
    sensory_details: str | None = None
    mood: str | None = None
    rules: str | None = None
    associated_characters: list[str] = []
    tags: list[str] = []
    ai_visible: bool = True


class LocationUpdate(BaseModel):
    name: str | None = None
    aliases: list[str] | None = None
    type: str | None = None
    short_description: str | None = None
    long_description: str | None = None
    sensory_details: str | None = None
    mood: str | None = None
    rules: str | None = None
    associated_characters: list[str] | None = None
    tags: list[str] | None = None
    ai_visible: bool | None = None


class LocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    aliases: list[str]
    type: str | None
    short_description: str | None
    long_description: str | None
    sensory_details: str | None
    mood: str | None
    rules: str | None
    associated_characters: list[str]
    tags: list[str]
    ai_visible: bool
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 5.5: Write schemas/worldbuilding.py**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class WorldbuildingCreate(BaseModel):
    title: str
    aliases: list[str] = []
    category: str = "other"
    short_description: str | None = None
    content: str | None = None
    rules: str | None = None
    contradictions_to_avoid: str | None = None
    related_characters: list[str] = []
    related_locations: list[str] = []
    tags: list[str] = []
    ai_visible: bool = True


class WorldbuildingUpdate(BaseModel):
    title: str | None = None
    aliases: list[str] | None = None
    category: str | None = None
    short_description: str | None = None
    content: str | None = None
    rules: str | None = None
    contradictions_to_avoid: str | None = None
    related_characters: list[str] | None = None
    related_locations: list[str] | None = None
    tags: list[str] | None = None
    ai_visible: bool | None = None


class WorldbuildingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    aliases: list[str]
    category: str
    short_description: str | None
    content: str | None
    rules: str | None
    contradictions_to_avoid: str | None
    related_characters: list[str]
    related_locations: list[str]
    tags: list[str]
    ai_visible: bool
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 5.6: Write services/crud_character.py**

```python
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.character import Character
from app.schemas.character import CharacterCreate, CharacterUpdate


async def create_character(
    db: AsyncSession, project_id: uuid.UUID, data: CharacterCreate
) -> Character:
    char = Character(project_id=project_id, **data.model_dump())
    db.add(char)
    await db.commit()
    await db.refresh(char)
    return char


async def get_character(db: AsyncSession, character_id: uuid.UUID) -> Character | None:
    result = await db.execute(select(Character).where(Character.id == character_id))
    return result.scalar_one_or_none()


async def list_characters(
    db: AsyncSession, project_id: uuid.UUID, limit: int = 100, offset: int = 0
) -> list[Character]:
    result = await db.execute(
        select(Character)
        .where(Character.project_id == project_id)
        .order_by(Character.created_at)
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_character(
    db: AsyncSession, char: Character, data: CharacterUpdate
) -> Character:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(char, field, value)
    await db.commit()
    await db.refresh(char)
    return char


async def delete_character(db: AsyncSession, char: Character) -> None:
    await db.delete(char)
    await db.commit()
```

- [ ] **Step 5.7: Write services/crud_location.py**

```python
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationUpdate


async def create_location(
    db: AsyncSession, project_id: uuid.UUID, data: LocationCreate
) -> Location:
    loc = Location(project_id=project_id, **data.model_dump())
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return loc


async def get_location(db: AsyncSession, location_id: uuid.UUID) -> Location | None:
    result = await db.execute(select(Location).where(Location.id == location_id))
    return result.scalar_one_or_none()


async def list_locations(
    db: AsyncSession, project_id: uuid.UUID, limit: int = 100, offset: int = 0
) -> list[Location]:
    result = await db.execute(
        select(Location)
        .where(Location.project_id == project_id)
        .order_by(Location.created_at)
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_location(
    db: AsyncSession, loc: Location, data: LocationUpdate
) -> Location:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    await db.commit()
    await db.refresh(loc)
    return loc


async def delete_location(db: AsyncSession, loc: Location) -> None:
    await db.delete(loc)
    await db.commit()
```

- [ ] **Step 5.8: Write services/crud_worldbuilding.py**

```python
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.worldbuilding import WorldbuildingEntry
from app.schemas.worldbuilding import WorldbuildingCreate, WorldbuildingUpdate


async def create_entry(
    db: AsyncSession, project_id: uuid.UUID, data: WorldbuildingCreate
) -> WorldbuildingEntry:
    entry = WorldbuildingEntry(project_id=project_id, **data.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_entry(db: AsyncSession, entry_id: uuid.UUID) -> WorldbuildingEntry | None:
    result = await db.execute(
        select(WorldbuildingEntry).where(WorldbuildingEntry.id == entry_id)
    )
    return result.scalar_one_or_none()


async def list_entries(
    db: AsyncSession,
    project_id: uuid.UUID,
    category: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[WorldbuildingEntry]:
    q = select(WorldbuildingEntry).where(WorldbuildingEntry.project_id == project_id)
    if category:
        q = q.where(WorldbuildingEntry.category == category)
    result = await db.execute(q.order_by(WorldbuildingEntry.created_at).offset(offset).limit(limit))
    return list(result.scalars().all())


async def update_entry(
    db: AsyncSession, entry: WorldbuildingEntry, data: WorldbuildingUpdate
) -> WorldbuildingEntry:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


async def delete_entry(db: AsyncSession, entry: WorldbuildingEntry) -> None:
    await db.delete(entry)
    await db.commit()
```

- [ ] **Step 5.9: Write api/v1/characters.py**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, get_db
from app.schemas.character import CharacterCreate, CharacterResponse, CharacterUpdate
from app.services import crud_character

router = APIRouter(tags=["codex"])


@router.get("/projects/{project_id}/characters", response_model=list[CharacterResponse])
async def list_characters(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[CharacterResponse]:
    return await crud_character.list_characters(db, project_id)


@router.post(
    "/projects/{project_id}/characters",
    response_model=CharacterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_character(
    project_id: uuid.UUID,
    data: CharacterCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CharacterResponse:
    return await crud_character.create_character(db, project_id, data)


@router.get("/characters/{character_id}", response_model=CharacterResponse)
async def get_character(
    character_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CharacterResponse:
    char = await crud_character.get_character(db, character_id)
    if char is None:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


@router.patch("/characters/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: uuid.UUID,
    data: CharacterUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CharacterResponse:
    char = await crud_character.get_character(db, character_id)
    if char is None:
        raise HTTPException(status_code=404, detail="Character not found")
    return await crud_character.update_character(db, char, data)


@router.delete("/characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    char = await crud_character.get_character(db, character_id)
    if char is None:
        raise HTTPException(status_code=404, detail="Character not found")
    await crud_character.delete_character(db, char)
```

- [ ] **Step 5.10: Write api/v1/locations.py**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, get_db
from app.schemas.location import LocationCreate, LocationResponse, LocationUpdate
from app.services import crud_location

router = APIRouter(tags=["codex"])


@router.get("/projects/{project_id}/locations", response_model=list[LocationResponse])
async def list_locations(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[LocationResponse]:
    return await crud_location.list_locations(db, project_id)


@router.post(
    "/projects/{project_id}/locations",
    response_model=LocationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_location(
    project_id: uuid.UUID,
    data: LocationCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> LocationResponse:
    return await crud_location.create_location(db, project_id, data)


@router.get("/locations/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> LocationResponse:
    loc = await crud_location.get_location(db, location_id)
    if loc is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc


@router.patch("/locations/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: uuid.UUID,
    data: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> LocationResponse:
    loc = await crud_location.get_location(db, location_id)
    if loc is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return await crud_location.update_location(db, loc, data)


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    loc = await crud_location.get_location(db, location_id)
    if loc is None:
        raise HTTPException(status_code=404, detail="Location not found")
    await crud_location.delete_location(db, loc)
```

- [ ] **Step 5.11: Write api/v1/worldbuilding.py**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, get_db
from app.schemas.worldbuilding import WorldbuildingCreate, WorldbuildingResponse, WorldbuildingUpdate
from app.services import crud_worldbuilding

router = APIRouter(tags=["codex"])


@router.get("/projects/{project_id}/worldbuilding", response_model=list[WorldbuildingResponse])
async def list_entries(
    project_id: uuid.UUID,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[WorldbuildingResponse]:
    return await crud_worldbuilding.list_entries(db, project_id, category=category)


@router.post(
    "/projects/{project_id}/worldbuilding",
    response_model=WorldbuildingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_entry(
    project_id: uuid.UUID,
    data: WorldbuildingCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> WorldbuildingResponse:
    return await crud_worldbuilding.create_entry(db, project_id, data)


@router.get("/worldbuilding/{entry_id}", response_model=WorldbuildingResponse)
async def get_entry(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> WorldbuildingResponse:
    entry = await crud_worldbuilding.get_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.patch("/worldbuilding/{entry_id}", response_model=WorldbuildingResponse)
async def update_entry(
    entry_id: uuid.UUID,
    data: WorldbuildingUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> WorldbuildingResponse:
    entry = await crud_worldbuilding.get_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return await crud_worldbuilding.update_entry(db, entry, data)


@router.delete("/worldbuilding/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    entry = await crud_worldbuilding.get_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    await crud_worldbuilding.delete_entry(db, entry)
```

- [ ] **Step 5.12: Register all three in router.py**

```python
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.beats import router as beats_router
from app.api.v1.books import router as books_router
from app.api.v1.chapters import router as chapters_router
from app.api.v1.characters import router as characters_router
from app.api.v1.locations import router as locations_router
from app.api.v1.projects import router as projects_router
from app.api.v1.scenes import router as scenes_router
from app.api.v1.worldbuilding import router as worldbuilding_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(books_router)
api_router.include_router(chapters_router)
api_router.include_router(scenes_router)
api_router.include_router(beats_router)
api_router.include_router(characters_router)
api_router.include_router(locations_router)
api_router.include_router(worldbuilding_router)
```

- [ ] **Step 5.13: Run tests and commit**

```bash
cd apps/api && uv run pytest tests/integration/test_codex_api.py -v
git add apps/api/app/schemas/character.py apps/api/app/schemas/location.py \
  apps/api/app/schemas/worldbuilding.py \
  apps/api/app/services/crud_character.py apps/api/app/services/crud_location.py \
  apps/api/app/services/crud_worldbuilding.py \
  apps/api/app/api/v1/characters.py apps/api/app/api/v1/locations.py \
  apps/api/app/api/v1/worldbuilding.py apps/api/app/api/v1/router.py \
  apps/api/tests/integration/test_codex_api.py
git commit -m "feat: Codex CRUD — Character, Location, WorldbuildingEntry with ai_visible"
```

---

## Task 6: CodexRelation + CodexProgression CRUD

**Files:**
- Create: `apps/api/app/schemas/codex_relation.py`
- Create: `apps/api/app/schemas/codex_progression.py`
- Create: `apps/api/app/services/crud_codex_relation.py`
- Create: `apps/api/app/services/crud_codex_progression.py`
- Create: `apps/api/app/api/v1/codex_relations.py`
- Create: `apps/api/app/api/v1/codex_progressions.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_codex_relations_api.py`

---

- [ ] **Step 6.1: Write failing integration test**

`apps/api/tests/integration/test_codex_relations_api.py`:

```python
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _setup(client, headers):
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=headers)).json()
    char1 = (
        await client.post(
            f"/api/v1/projects/{proj['id']}/characters",
            json={"name": "Anna"},
            headers=headers,
        )
    ).json()
    char2 = (
        await client.post(
            f"/api/v1/projects/{proj['id']}/characters",
            json={"name": "Béla"},
            headers=headers,
        )
    ).json()
    return proj["id"], char1["id"], char2["id"]


async def test_create_codex_relation(client: AsyncClient, auth_headers: dict) -> None:
    project_id, char1_id, char2_id = await _setup(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "source_type": "character",
            "source_id": char1_id,
            "target_type": "character",
            "target_id": char2_id,
            "relation_type": "related",
            "description": "Testvérek",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["relation_type"] == "related"
    assert response.json()["auto_include_in_context"] is True


async def test_create_codex_progression(client: AsyncClient, auth_headers: dict) -> None:
    project_id, char1_id, _ = await _setup(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/codex-progressions",
        json={
            "codex_entry_type": "character",
            "codex_entry_id": char1_id,
            "title": "Elveszíti a kezét",
            "activation_type": "after_chapter",
            "activates_after_chapter_order": 5,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["is_spoiler"] is True
```

- [ ] **Step 6.2: Write schemas/codex_relation.py**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CodexRelationCreate(BaseModel):
    source_type: str
    source_id: uuid.UUID
    target_type: str
    target_id: uuid.UUID
    relation_type: str
    description: str | None = None
    auto_include_in_context: bool = True


class CodexRelationUpdate(BaseModel):
    relation_type: str | None = None
    description: str | None = None
    auto_include_in_context: bool | None = None


class CodexRelationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    source_type: str
    source_id: uuid.UUID
    target_type: str
    target_id: uuid.UUID
    relation_type: str
    description: str | None
    auto_include_in_context: bool
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 6.3: Write schemas/codex_progression.py**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CodexProgressionCreate(BaseModel):
    codex_entry_type: str
    codex_entry_id: uuid.UUID
    title: str
    description: str | None = None
    override_field: str | None = None
    override_value: str | None = None
    activation_type: str
    activates_after_scene_id: uuid.UUID | None = None
    activates_after_chapter_id: uuid.UUID | None = None
    activates_after_chapter_order: int | None = None
    is_spoiler: bool = True


class CodexProgressionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    override_field: str | None = None
    override_value: str | None = None
    activation_type: str | None = None
    activates_after_scene_id: uuid.UUID | None = None
    activates_after_chapter_id: uuid.UUID | None = None
    activates_after_chapter_order: int | None = None
    is_spoiler: bool | None = None


class CodexProgressionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    codex_entry_type: str
    codex_entry_id: uuid.UUID
    title: str
    description: str | None
    override_field: str | None
    override_value: str | None
    activation_type: str
    activates_after_scene_id: uuid.UUID | None
    activates_after_chapter_id: uuid.UUID | None
    activates_after_chapter_order: int | None
    is_spoiler: bool
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 6.4: Write services/crud_codex_relation.py**

```python
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.codex_relation import CodexRelation
from app.schemas.codex_relation import CodexRelationCreate, CodexRelationUpdate


async def create_relation(
    db: AsyncSession, project_id: uuid.UUID, data: CodexRelationCreate
) -> CodexRelation:
    relation = CodexRelation(project_id=project_id, **data.model_dump())
    db.add(relation)
    await db.commit()
    await db.refresh(relation)
    return relation


async def list_relations(
    db: AsyncSession, project_id: uuid.UUID
) -> list[CodexRelation]:
    result = await db.execute(
        select(CodexRelation).where(CodexRelation.project_id == project_id)
    )
    return list(result.scalars().all())


async def get_relation(db: AsyncSession, relation_id: uuid.UUID) -> CodexRelation | None:
    result = await db.execute(select(CodexRelation).where(CodexRelation.id == relation_id))
    return result.scalar_one_or_none()


async def update_relation(
    db: AsyncSession, relation: CodexRelation, data: CodexRelationUpdate
) -> CodexRelation:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(relation, field, value)
    await db.commit()
    await db.refresh(relation)
    return relation


async def delete_relation(db: AsyncSession, relation: CodexRelation) -> None:
    await db.delete(relation)
    await db.commit()
```

- [ ] **Step 6.5: Write services/crud_codex_progression.py**

```python
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.codex_progression import CodexProgression
from app.schemas.codex_progression import CodexProgressionCreate, CodexProgressionUpdate


async def create_progression(
    db: AsyncSession, project_id: uuid.UUID, data: CodexProgressionCreate
) -> CodexProgression:
    prog = CodexProgression(project_id=project_id, **data.model_dump())
    db.add(prog)
    await db.commit()
    await db.refresh(prog)
    return prog


async def list_progressions(
    db: AsyncSession, project_id: uuid.UUID, codex_entry_id: uuid.UUID | None = None
) -> list[CodexProgression]:
    q = select(CodexProgression).where(CodexProgression.project_id == project_id)
    if codex_entry_id:
        q = q.where(CodexProgression.codex_entry_id == codex_entry_id)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_progression(
    db: AsyncSession, progression_id: uuid.UUID
) -> CodexProgression | None:
    result = await db.execute(
        select(CodexProgression).where(CodexProgression.id == progression_id)
    )
    return result.scalar_one_or_none()


async def update_progression(
    db: AsyncSession, prog: CodexProgression, data: CodexProgressionUpdate
) -> CodexProgression:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prog, field, value)
    await db.commit()
    await db.refresh(prog)
    return prog


async def delete_progression(db: AsyncSession, prog: CodexProgression) -> None:
    await db.delete(prog)
    await db.commit()
```

- [ ] **Step 6.6: Write api/v1/codex_relations.py**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, get_db
from app.schemas.codex_relation import CodexRelationCreate, CodexRelationResponse, CodexRelationUpdate
from app.services import crud_codex_relation

router = APIRouter(tags=["codex-relations"])


@router.get("/projects/{project_id}/codex-relations", response_model=list[CodexRelationResponse])
async def list_relations(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[CodexRelationResponse]:
    return await crud_codex_relation.list_relations(db, project_id)


@router.post(
    "/projects/{project_id}/codex-relations",
    response_model=CodexRelationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_relation(
    project_id: uuid.UUID,
    data: CodexRelationCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexRelationResponse:
    return await crud_codex_relation.create_relation(db, project_id, data)


@router.patch("/codex-relations/{relation_id}", response_model=CodexRelationResponse)
async def update_relation(
    relation_id: uuid.UUID,
    data: CodexRelationUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexRelationResponse:
    relation = await crud_codex_relation.get_relation(db, relation_id)
    if relation is None:
        raise HTTPException(status_code=404, detail="Relation not found")
    return await crud_codex_relation.update_relation(db, relation, data)


@router.delete("/codex-relations/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relation(
    relation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    relation = await crud_codex_relation.get_relation(db, relation_id)
    if relation is None:
        raise HTTPException(status_code=404, detail="Relation not found")
    await crud_codex_relation.delete_relation(db, relation)
```

- [ ] **Step 6.7: Write api/v1/codex_progressions.py**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, get_db
from app.schemas.codex_progression import (
    CodexProgressionCreate,
    CodexProgressionResponse,
    CodexProgressionUpdate,
)
from app.services import crud_codex_progression

router = APIRouter(tags=["codex-progressions"])


@router.get(
    "/projects/{project_id}/codex-progressions",
    response_model=list[CodexProgressionResponse],
)
async def list_progressions(
    project_id: uuid.UUID,
    codex_entry_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[CodexProgressionResponse]:
    return await crud_codex_progression.list_progressions(
        db, project_id, codex_entry_id=codex_entry_id
    )


@router.post(
    "/projects/{project_id}/codex-progressions",
    response_model=CodexProgressionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_progression(
    project_id: uuid.UUID,
    data: CodexProgressionCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexProgressionResponse:
    return await crud_codex_progression.create_progression(db, project_id, data)


@router.patch(
    "/codex-progressions/{progression_id}", response_model=CodexProgressionResponse
)
async def update_progression(
    progression_id: uuid.UUID,
    data: CodexProgressionUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexProgressionResponse:
    prog = await crud_codex_progression.get_progression(db, progression_id)
    if prog is None:
        raise HTTPException(status_code=404, detail="Progression not found")
    return await crud_codex_progression.update_progression(db, prog, data)


@router.delete(
    "/codex-progressions/{progression_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_progression(
    progression_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    prog = await crud_codex_progression.get_progression(db, progression_id)
    if prog is None:
        raise HTTPException(status_code=404, detail="Progression not found")
    await crud_codex_progression.delete_progression(db, prog)
```

- [ ] **Step 6.8: Register in router.py**

Add to the existing router.py imports and `include_router` calls:

```python
from app.api.v1.codex_relations import router as codex_relations_router
from app.api.v1.codex_progressions import router as codex_progressions_router
# ... existing imports ...
api_router.include_router(codex_relations_router)
api_router.include_router(codex_progressions_router)
```

- [ ] **Step 6.9: Run tests and commit**

```bash
cd apps/api && uv run pytest tests/integration/test_codex_relations_api.py -v
git add apps/api/app/schemas/codex_relation.py apps/api/app/schemas/codex_progression.py \
  apps/api/app/services/crud_codex_relation.py apps/api/app/services/crud_codex_progression.py \
  apps/api/app/api/v1/codex_relations.py apps/api/app/api/v1/codex_progressions.py \
  apps/api/app/api/v1/router.py apps/api/tests/integration/test_codex_relations_api.py
git commit -m "feat: CodexRelation + CodexProgression CRUD (MVP: schema only, no AI filtering yet)"
```

---

## Task 7: Snippet + StyleGuide CRUD

**Files:**
- Create: `apps/api/app/schemas/snippet.py`
- Create: `apps/api/app/schemas/style_guide.py`
- Create: `apps/api/app/services/crud_snippet.py`
- Create: `apps/api/app/services/crud_style_guide.py`
- Create: `apps/api/app/api/v1/snippets.py`
- Create: `apps/api/app/api/v1/style_guides.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_snippets_api.py`

---

- [ ] **Step 7.1: Write failing integration test**

`apps/api/tests/integration/test_snippets_api.py`:

```python
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _project(client, headers):
    return (
        await client.post("/api/v1/projects", json={"title": "P"}, headers=headers)
    ).json()["id"]


async def test_create_snippet_returns_201(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _project(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={
            "content": "A rozsdás kapupánt...",
            "content_type": "describe_result",
            "source_sense": "sight",
            "tags": ["describe", "sight"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["content_type"] == "describe_result"
    assert data["source_sense"] == "sight"
    assert "describe" in data["tags"]


async def test_list_snippets_filter_by_content_type(
    client: AsyncClient, auth_headers: dict
) -> None:
    project_id = await _project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"content": "todo item", "content_type": "todo"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"content": "note item", "content_type": "note"},
        headers=auth_headers,
    )
    response = await client.get(
        f"/api/v1/projects/{project_id}/snippets?content_type=todo",
        headers=auth_headers,
    )
    assert response.status_code == 200
    results = response.json()
    assert all(s["content_type"] == "todo" for s in results)


async def test_create_style_guide(client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _project(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/style-guides",
        json={
            "title": "Fő stíluslap",
            "narrative_pov": "third_limited",
            "tense": "past",
            "tone": "komor, feszült",
            "forbidden_phrases": ["hirtelen", "egyszer csak"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["tone"] == "komor, feszült"
    assert "hirtelen" in response.json()["forbidden_phrases"]
```

- [ ] **Step 7.2: Write schemas/snippet.py**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SnippetCreate(BaseModel):
    content: str
    content_type: str = "note"
    title: str | None = None
    book_id: uuid.UUID | None = None
    chapter_id: uuid.UUID | None = None
    scene_id: uuid.UUID | None = None
    source_sense: str | None = None
    tags: list[str] = []


class SnippetUpdate(BaseModel):
    content: str | None = None
    content_type: str | None = None
    title: str | None = None
    scene_id: uuid.UUID | None = None
    source_sense: str | None = None
    tags: list[str] | None = None


class SnippetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    book_id: uuid.UUID | None
    chapter_id: uuid.UUID | None
    scene_id: uuid.UUID | None
    title: str | None
    content: str
    content_type: str
    source_sense: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 7.3: Write schemas/style_guide.py**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class StyleGuideCreate(BaseModel):
    title: str
    book_id: uuid.UUID | None = None
    narrative_pov: str | None = None
    tense: str | None = None
    tone: str | None = None
    style_description: str | None = None
    dialogue_rules: str | None = None
    hungarian_language_rules: str | None = None
    forbidden_phrases: list[str] = []
    preferred_phrases: list[str] = []
    examples_good: list[str] = []
    examples_bad: list[str] = []


class StyleGuideUpdate(BaseModel):
    title: str | None = None
    narrative_pov: str | None = None
    tense: str | None = None
    tone: str | None = None
    style_description: str | None = None
    dialogue_rules: str | None = None
    hungarian_language_rules: str | None = None
    forbidden_phrases: list[str] | None = None
    preferred_phrases: list[str] | None = None
    examples_good: list[str] | None = None
    examples_bad: list[str] | None = None


class StyleGuideResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    book_id: uuid.UUID | None
    title: str
    narrative_pov: str | None
    tense: str | None
    tone: str | None
    style_description: str | None
    dialogue_rules: str | None
    hungarian_language_rules: str | None
    forbidden_phrases: list[str]
    preferred_phrases: list[str]
    examples_good: list[str]
    examples_bad: list[str]
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 7.4: Write services/crud_snippet.py**

```python
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.snippet import Snippet
from app.schemas.snippet import SnippetCreate, SnippetUpdate


async def create_snippet(
    db: AsyncSession, project_id: uuid.UUID, data: SnippetCreate
) -> Snippet:
    snippet = Snippet(project_id=project_id, **data.model_dump())
    db.add(snippet)
    await db.commit()
    await db.refresh(snippet)
    return snippet


async def list_snippets(
    db: AsyncSession,
    project_id: uuid.UUID,
    content_type: str | None = None,
    scene_id: uuid.UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Snippet]:
    q = select(Snippet).where(Snippet.project_id == project_id)
    if content_type:
        q = q.where(Snippet.content_type == content_type)
    if scene_id:
        q = q.where(Snippet.scene_id == scene_id)
    result = await db.execute(q.order_by(Snippet.created_at.desc()).offset(offset).limit(limit))
    return list(result.scalars().all())


async def get_snippet(db: AsyncSession, snippet_id: uuid.UUID) -> Snippet | None:
    result = await db.execute(select(Snippet).where(Snippet.id == snippet_id))
    return result.scalar_one_or_none()


async def update_snippet(db: AsyncSession, snippet: Snippet, data: SnippetUpdate) -> Snippet:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(snippet, field, value)
    await db.commit()
    await db.refresh(snippet)
    return snippet


async def delete_snippet(db: AsyncSession, snippet: Snippet) -> None:
    await db.delete(snippet)
    await db.commit()
```

- [ ] **Step 7.5: Write services/crud_style_guide.py**

```python
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.style_guide import StyleGuide
from app.schemas.style_guide import StyleGuideCreate, StyleGuideUpdate


async def create_style_guide(
    db: AsyncSession, project_id: uuid.UUID, data: StyleGuideCreate
) -> StyleGuide:
    sg = StyleGuide(project_id=project_id, **data.model_dump())
    db.add(sg)
    await db.commit()
    await db.refresh(sg)
    return sg


async def list_style_guides(
    db: AsyncSession, project_id: uuid.UUID
) -> list[StyleGuide]:
    result = await db.execute(
        select(StyleGuide).where(StyleGuide.project_id == project_id)
    )
    return list(result.scalars().all())


async def get_style_guide(db: AsyncSession, sg_id: uuid.UUID) -> StyleGuide | None:
    result = await db.execute(select(StyleGuide).where(StyleGuide.id == sg_id))
    return result.scalar_one_or_none()


async def update_style_guide(
    db: AsyncSession, sg: StyleGuide, data: StyleGuideUpdate
) -> StyleGuide:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sg, field, value)
    await db.commit()
    await db.refresh(sg)
    return sg


async def delete_style_guide(db: AsyncSession, sg: StyleGuide) -> None:
    await db.delete(sg)
    await db.commit()
```

- [ ] **Step 7.6: Write api/v1/snippets.py**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, get_db
from app.schemas.snippet import SnippetCreate, SnippetResponse, SnippetUpdate
from app.services import crud_snippet

router = APIRouter(tags=["snippets"])


@router.get("/projects/{project_id}/snippets", response_model=list[SnippetResponse])
async def list_snippets(
    project_id: uuid.UUID,
    content_type: str | None = None,
    scene_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[SnippetResponse]:
    return await crud_snippet.list_snippets(
        db, project_id, content_type=content_type, scene_id=scene_id
    )


@router.post(
    "/projects/{project_id}/snippets",
    response_model=SnippetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_snippet(
    project_id: uuid.UUID,
    data: SnippetCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SnippetResponse:
    return await crud_snippet.create_snippet(db, project_id, data)


@router.patch("/snippets/{snippet_id}", response_model=SnippetResponse)
async def update_snippet(
    snippet_id: uuid.UUID,
    data: SnippetUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SnippetResponse:
    snippet = await crud_snippet.get_snippet(db, snippet_id)
    if snippet is None:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return await crud_snippet.update_snippet(db, snippet, data)


@router.delete("/snippets/{snippet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snippet(
    snippet_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    snippet = await crud_snippet.get_snippet(db, snippet_id)
    if snippet is None:
        raise HTTPException(status_code=404, detail="Snippet not found")
    await crud_snippet.delete_snippet(db, snippet)
```

- [ ] **Step 7.7: Write api/v1/style_guides.py**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, get_db
from app.schemas.style_guide import StyleGuideCreate, StyleGuideResponse, StyleGuideUpdate
from app.services import crud_style_guide

router = APIRouter(tags=["style-guides"])


@router.get("/projects/{project_id}/style-guides", response_model=list[StyleGuideResponse])
async def list_style_guides(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[StyleGuideResponse]:
    return await crud_style_guide.list_style_guides(db, project_id)


@router.post(
    "/projects/{project_id}/style-guides",
    response_model=StyleGuideResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_style_guide(
    project_id: uuid.UUID,
    data: StyleGuideCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> StyleGuideResponse:
    return await crud_style_guide.create_style_guide(db, project_id, data)


@router.get("/style-guides/{sg_id}", response_model=StyleGuideResponse)
async def get_style_guide(
    sg_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> StyleGuideResponse:
    sg = await crud_style_guide.get_style_guide(db, sg_id)
    if sg is None:
        raise HTTPException(status_code=404, detail="StyleGuide not found")
    return sg


@router.patch("/style-guides/{sg_id}", response_model=StyleGuideResponse)
async def update_style_guide(
    sg_id: uuid.UUID,
    data: StyleGuideUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> StyleGuideResponse:
    sg = await crud_style_guide.get_style_guide(db, sg_id)
    if sg is None:
        raise HTTPException(status_code=404, detail="StyleGuide not found")
    return await crud_style_guide.update_style_guide(db, sg, data)


@router.delete("/style-guides/{sg_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_style_guide(
    sg_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    sg = await crud_style_guide.get_style_guide(db, sg_id)
    if sg is None:
        raise HTTPException(status_code=404, detail="StyleGuide not found")
    await crud_style_guide.delete_style_guide(db, sg)
```

- [ ] **Step 7.8: Register in router.py (final state)**

```python
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.beats import router as beats_router
from app.api.v1.books import router as books_router
from app.api.v1.chapters import router as chapters_router
from app.api.v1.characters import router as characters_router
from app.api.v1.codex_progressions import router as codex_progressions_router
from app.api.v1.codex_relations import router as codex_relations_router
from app.api.v1.locations import router as locations_router
from app.api.v1.projects import router as projects_router
from app.api.v1.scenes import router as scenes_router
from app.api.v1.snippets import router as snippets_router
from app.api.v1.style_guides import router as style_guides_router
from app.api.v1.worldbuilding import router as worldbuilding_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(books_router)
api_router.include_router(chapters_router)
api_router.include_router(scenes_router)
api_router.include_router(beats_router)
api_router.include_router(characters_router)
api_router.include_router(locations_router)
api_router.include_router(worldbuilding_router)
api_router.include_router(codex_relations_router)
api_router.include_router(codex_progressions_router)
api_router.include_router(snippets_router)
api_router.include_router(style_guides_router)
```

- [ ] **Step 7.9: Run all tests**

```bash
cd apps/api && uv run pytest tests/integration/test_snippets_api.py -v
cd apps/api && uv run pytest -v --tb=short
```

Expected: All tests pass across all integration suites.

- [ ] **Step 7.10: Commit**

```bash
git add apps/api/app/schemas/snippet.py apps/api/app/schemas/style_guide.py \
  apps/api/app/services/crud_snippet.py apps/api/app/services/crud_style_guide.py \
  apps/api/app/api/v1/snippets.py apps/api/app/api/v1/style_guides.py \
  apps/api/app/api/v1/router.py apps/api/tests/integration/test_snippets_api.py
git commit -m "feat: Snippet + StyleGuide CRUD; all CRUD endpoints registered"
```

---

## Task 8: GenerationJob read + accept + reject

**Files:**
- Create: `apps/api/app/schemas/generation_job.py`
- Create: `apps/api/app/services/crud_generation_job.py`
- Create: `apps/api/app/api/v1/generation_jobs.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_generation_jobs_api.py`

These endpoints are read-only from the user's perspective — jobs are created by AI service, users can only GET, accept, or reject them.

---

- [ ] **Step 8.1: Write schemas/generation_job.py**

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class GenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    book_id: uuid.UUID | None
    chapter_id: uuid.UUID | None
    scene_id: uuid.UUID | None
    job_type: str
    status: str
    model_provider: str | None
    model_name: str | None
    prompt_version: str | None
    input_json: dict | None
    output_json: dict | None
    error_message: str | None
    created_by_user_id: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 8.2: Write services/crud_generation_job.py**

```python
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.generation_job import GenerationJob


async def get_job(db: AsyncSession, job_id: uuid.UUID) -> GenerationJob | None:
    result = await db.execute(select(GenerationJob).where(GenerationJob.id == job_id))
    return result.scalar_one_or_none()


async def list_jobs(
    db: AsyncSession, project_id: uuid.UUID, limit: int = 50
) -> list[GenerationJob]:
    result = await db.execute(
        select(GenerationJob)
        .where(GenerationJob.project_id == project_id)
        .order_by(GenerationJob.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def accept_job(db: AsyncSession, job: GenerationJob) -> GenerationJob:
    job.status = "accepted"
    await db.commit()
    await db.refresh(job)
    return job


async def reject_job(db: AsyncSession, job: GenerationJob) -> GenerationJob:
    job.status = "rejected"
    await db.commit()
    await db.refresh(job)
    return job
```

- [ ] **Step 8.3: Write api/v1/generation_jobs.py**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user, get_db
from app.schemas.generation_job import GenerationJobResponse
from app.services import crud_generation_job

router = APIRouter(prefix="/generation-jobs", tags=["generation-jobs"])


@router.get("/{job_id}", response_model=GenerationJobResponse)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> GenerationJobResponse:
    job = await crud_generation_job.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/accept", response_model=GenerationJobResponse)
async def accept_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> GenerationJobResponse:
    job = await crud_generation_job.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return await crud_generation_job.accept_job(db, job)


@router.post("/{job_id}/reject", response_model=GenerationJobResponse)
async def reject_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> GenerationJobResponse:
    job = await crud_generation_job.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return await crud_generation_job.reject_job(db, job)
```

- [ ] **Step 8.4: Register in router.py**

Add to router.py final state:

```python
from app.api.v1.generation_jobs import router as generation_jobs_router
# ... after other includes:
api_router.include_router(generation_jobs_router)
```

- [ ] **Step 8.5: Run full test suite**

```bash
cd apps/api && uv run pytest -v --tb=short
```

Expected: All tests pass. No regressions.

- [ ] **Step 8.6: Final lint check**

```bash
cd apps/api && uv run ruff check app/ tests/ --fix
```

- [ ] **Step 8.7: Commit**

```bash
git add apps/api/app/schemas/generation_job.py apps/api/app/services/crud_generation_job.py \
  apps/api/app/api/v1/generation_jobs.py apps/api/app/api/v1/router.py
git commit -m "feat: GenerationJob read + accept/reject; Plan 2 CRUD complete"
```

---

## Plan 2 complete

At this point the API serves all CRUD resources. Verify with:

```bash
cd apps/api && uv run uvicorn app.main:app --reload
# Open: http://localhost:8000/docs
```

All routes should be visible in the Swagger UI. Proceed to Plan 3 (AI features).
