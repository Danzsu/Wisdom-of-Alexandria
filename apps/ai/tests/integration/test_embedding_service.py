"""EmbeddingService sync + retrieval tests (B2b).

SQLite-safe tier (default): all of these mock ``ModelRouter.embed`` so no real
embedding provider is called. They cover the indexing contract — hash-cache
idempotency, ai_visible gating + deletion-on-toggle, bounded sync, project
scoping and the upsert/skip/delete counts.

The cosine-ORDERING + query-time ai_visible filtering tests live in
``test_embedding_retrieval_pg.py`` and are ``@pytest.mark.postgres`` (the ``<=>``
operator is PostgreSQL-only).
"""

import uuid
from unittest.mock import AsyncMock

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.embedding import Embedding
from alexandria_core.models.location import Location
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from alexandria_core.models.series import Series
from alexandria_core.models.style_guide import StyleGuide
from sqlalchemy import func, select

from app.services.embedding_service import EmbeddingService
from app.services.model_router import ModelRouter

EMBED_MODEL = "openai/text-embedding-3-small"


def _mock_router(dim: int = 4) -> ModelRouter:
    """A ModelRouter whose ``embed`` returns one deterministic vector per input."""
    router = AsyncMock(spec=ModelRouter)

    async def _embed(texts, model, db=None, **kwargs):
        # One distinct-but-deterministic vector per input (value = index+1).
        return [[float(i + 1)] * dim for i in range(len(texts))]

    router.embed.side_effect = _embed
    return router


async def _make_project(db) -> uuid.UUID:
    project = Project(title="RAG projekt")
    db.add(project)
    await db.flush()
    await db.commit()
    return project.id


async def _count_embeddings(db, project_id: uuid.UUID) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(Embedding)
            .where(Embedding.project_id == project_id)
        )
    ).scalar_one()


# ── hash-cache idempotency ─────────────────────────────────────────────────────


@pytest.mark.integration
async def test_sync_indexes_visible_codex_entry(db_session):
    project_id = await _make_project(db_session)
    db_session.add(
        CodexEntry(
            project_id=project_id,
            title="Aranykard",
            content="Egy legendás penge.",
            ai_visible=True,
        )
    )
    await db_session.commit()

    router = _mock_router()
    svc = EmbeddingService(router=router)
    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)

    assert result.indexed == 1
    assert await _count_embeddings(db_session, project_id) == 1
    row = (
        await db_session.execute(
            select(Embedding).where(
                Embedding.project_id == project_id,
                Embedding.entity_type == "codex",
            )
        )
    ).scalar_one()
    # project-scoped entity → project_id set, book_id NULL.
    assert row.project_id == project_id
    assert row.book_id is None
    assert row.embedding is not None


@pytest.mark.integration
async def test_sync_is_idempotent_unchanged_content_not_reembedded(db_session):
    """2nd sync over unchanged content does NO re-embed (hash-cache hit)."""
    project_id = await _make_project(db_session)
    db_session.add(
        CodexEntry(project_id=project_id, title="Vár", content="Kőből épült.", ai_visible=True)
    )
    await db_session.commit()

    router = _mock_router()
    svc = EmbeddingService(router=router)

    first = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert first.indexed == 1
    embed_calls_after_first = router.embed.await_count

    second = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    # Nothing changed → skipped, and embed() was NOT called again.
    assert second.indexed == 0
    assert second.updated == 0
    assert second.skipped == 1
    assert router.embed.await_count == embed_calls_after_first


@pytest.mark.integration
async def test_sync_changed_content_is_reembedded(db_session):
    project_id = await _make_project(db_session)
    entry = CodexEntry(
        project_id=project_id, title="Folyó", content="Lassú víz.", ai_visible=True
    )
    db_session.add(entry)
    await db_session.commit()

    router = _mock_router()
    svc = EmbeddingService(router=router)
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)

    entry.content = "Sebes, hideg hegyi patak."
    await db_session.commit()

    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert result.updated == 1
    assert result.indexed == 0
    assert await _count_embeddings(db_session, project_id) == 1  # upsert in place


# ── ai_visible gating + deletion on toggle ─────────────────────────────────────


@pytest.mark.integration
async def test_ai_invisible_entity_is_not_indexed(db_session):
    project_id = await _make_project(db_session)
    db_session.add(
        Character(
            project_id=project_id,
            name="Titkos kém",
            description="Rejtett karakter.",
            ai_visible=False,
        )
    )
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert result.indexed == 0
    assert await _count_embeddings(db_session, project_id) == 0


@pytest.mark.integration
async def test_toggling_ai_visible_false_deletes_embedding(db_session):
    project_id = await _make_project(db_session)
    char = Character(
        project_id=project_id, name="Aragorn", description="Egy vándor.", ai_visible=True
    )
    db_session.add(char)
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert await _count_embeddings(db_session, project_id) == 1

    # Hide it → next sync must delete its embedding row.
    char.ai_visible = False
    await db_session.commit()

    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert result.deleted == 1
    assert await _count_embeddings(db_session, project_id) == 0


@pytest.mark.integration
async def test_deleted_entity_embedding_is_reconciled_away(db_session):
    project_id = await _make_project(db_session)
    loc = Location(
        project_id=project_id, name="Rivendell", description="Tünde menedék.", ai_visible=True
    )
    db_session.add(loc)
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert await _count_embeddings(db_session, project_id) == 1

    await db_session.delete(loc)
    await db_session.commit()

    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert result.deleted == 1
    assert await _count_embeddings(db_session, project_id) == 0


# ── manuscript (scene/chapter) scoping ─────────────────────────────────────────


@pytest.mark.integration
async def test_scene_and_chapter_indexed_with_book_provenance(db_session):
    project_id = await _make_project(db_session)
    book = Book(project_id=project_id, title="I. kötet")
    db_session.add(book)
    await db_session.flush()
    chapter = Chapter(book_id=book.id, title="1. fejezet", summary="A kezdet.")
    db_session.add(chapter)
    await db_session.flush()
    scene = Scene(
        chapter_id=chapter.id,
        title="Nyitójelenet",
        content="Hosszú jelenet szövege.",
        summary="Rövid összefoglaló.",
    )
    db_session.add(scene)
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    # one scene + one chapter.
    assert result.indexed == 2

    scene_emb = (
        await db_session.execute(
            select(Embedding).where(
                Embedding.project_id == project_id,
                Embedding.entity_type == "scene",
            )
        )
    ).scalar_one()
    # Manuscript entities carry book_id provenance + the project scope.
    assert scene_emb.project_id == project_id
    assert scene_emb.book_id == book.id


@pytest.mark.integration
async def test_style_guide_indexed(db_session):
    project_id = await _make_project(db_session)
    db_session.add(
        StyleGuide(
            project_id=project_id,
            tone="Komor, drámai.",
            pov="E/3",
            tense="múlt idő",
        )
    )
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert result.indexed == 1
    row = (
        await db_session.execute(
            select(Embedding).where(
                Embedding.project_id == project_id,
                Embedding.entity_type == "styleguide",
            )
        )
    ).scalar_one()
    assert row.project_id == project_id


# ── project isolation ──────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_sync_only_touches_target_project(db_session):
    p1 = await _make_project(db_session)
    p2 = await _make_project(db_session)
    db_session.add(CodexEntry(project_id=p1, title="P1 kártya", content="egy", ai_visible=True))
    db_session.add(CodexEntry(project_id=p2, title="P2 kártya", content="kettő", ai_visible=True))
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    await svc.sync_project(db_session, p1, embedding_model=EMBED_MODEL)

    assert await _count_embeddings(db_session, p1) == 1
    assert await _count_embeddings(db_session, p2) == 0  # untouched


# ── bounded sync ───────────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_sync_is_bounded_by_max_items(db_session):
    project_id = await _make_project(db_session)
    for i in range(5):
        db_session.add(
            CodexEntry(
                project_id=project_id,
                title=f"Kártya {i}",
                content=f"Tartalom {i}",
                ai_visible=True,
            )
        )
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    result = await svc.sync_project(
        db_session, project_id, embedding_model=EMBED_MODEL, max_items=2
    )
    # Capped at 2 writes this run; the rest are left for a later run.
    assert result.indexed == 2
    assert result.capped is True
    assert await _count_embeddings(db_session, project_id) == 2


# ── empty-source guard ─────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_entity_with_no_text_is_skipped(db_session):
    """A codex card with no meaningful text contributes nothing to index."""
    project_id = await _make_project(db_session)
    db_session.add(CodexEntry(project_id=project_id, title="", content=None, ai_visible=True))
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    assert result.indexed == 0
    assert await _count_embeddings(db_session, project_id) == 0


# ── series scope on sync (B3b) ─────────────────────────────────────────────────


async def _make_series(db, project_id: uuid.UUID, title: str = "Sorozat") -> uuid.UUID:
    series = Series(project_id=project_id, title=title)
    db.add(series)
    await db.flush()
    await db.commit()
    return series.id


async def _emb_row(db, project_id: uuid.UUID, entity_type: str) -> Embedding:
    return (
        await db.execute(
            select(Embedding).where(
                Embedding.project_id == project_id,
                Embedding.entity_type == entity_type,
            )
        )
    ).scalar_one()


@pytest.mark.integration
async def test_sync_sets_codex_series_id_from_entry(db_session):
    """A series-scoped codex entry's embedding carries that series_id; a
    project-global one (series_id NULL) carries NULL."""
    project_id = await _make_project(db_session)
    series_id = await _make_series(db_session, project_id)
    db_session.add(
        CodexEntry(
            project_id=project_id,
            series_id=series_id,
            title="Sorozat-kódex",
            content="Csak ehhez a sorozathoz.",
            ai_visible=True,
        )
    )
    db_session.add(
        CodexEntry(
            project_id=project_id,
            series_id=None,
            title="Globális kódex",
            content="Minden könyvhöz.",
            ai_visible=True,
        )
    )
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)

    rows = (
        await db_session.execute(
            select(Embedding).where(
                Embedding.project_id == project_id,
                Embedding.entity_type == "codex",
            )
        )
    ).scalars().all()
    by_series = {r.series_id for r in rows}
    assert by_series == {series_id, None}


@pytest.mark.integration
async def test_sync_sets_scene_chapter_series_id_from_book(db_session):
    """Scene/chapter embeddings inherit the owning BOOK's series_id."""
    project_id = await _make_project(db_session)
    series_id = await _make_series(db_session, project_id)
    book = Book(project_id=project_id, title="Sorozat-kötet", series_id=series_id)
    db_session.add(book)
    await db_session.flush()
    chapter = Chapter(book_id=book.id, title="1. fejezet", summary="Kezdet.")
    db_session.add(chapter)
    await db_session.flush()
    scene = Scene(
        chapter_id=chapter.id, title="Jelenet", content="Szöveg.", summary="Össz."
    )
    db_session.add(scene)
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)

    scene_emb = await _emb_row(db_session, project_id, "scene")
    chapter_emb = await _emb_row(db_session, project_id, "chapter")
    assert scene_emb.series_id == series_id
    assert chapter_emb.series_id == series_id


@pytest.mark.integration
async def test_sync_scene_series_id_null_when_book_not_in_series(db_session):
    """A book with no series → its scene/chapter embeddings keep series_id NULL."""
    project_id = await _make_project(db_session)
    book = Book(project_id=project_id, title="Magányos kötet")  # series_id NULL
    db_session.add(book)
    await db_session.flush()
    chapter = Chapter(book_id=book.id, title="Fejezet", summary="Össz.")
    db_session.add(chapter)
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)

    chapter_emb = await _emb_row(db_session, project_id, "chapter")
    assert chapter_emb.series_id is None


@pytest.mark.integration
async def test_sync_project_global_entities_have_null_series_id(db_session):
    """Character / style-guide are project-global → series_id always NULL even
    when the project HAS a series."""
    project_id = await _make_project(db_session)
    await _make_series(db_session, project_id)
    db_session.add(
        Character(
            project_id=project_id, name="Hős", description="Leírás.", ai_visible=True
        )
    )
    db_session.add(
        StyleGuide(project_id=project_id, tone="Komor.", pov="E/3", tense="múlt")
    )
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)

    char_emb = await _emb_row(db_session, project_id, "character")
    sg_emb = await _emb_row(db_session, project_id, "styleguide")
    assert char_emb.series_id is None
    assert sg_emb.series_id is None


@pytest.mark.integration
async def test_codex_moved_to_another_series_resyncs_series_id(db_session):
    """A codex entry re-assigned to a different series updates its embedding's
    series_id on re-sync WITHOUT re-embedding (content unchanged) — no stale
    series_id persists."""
    project_id = await _make_project(db_session)
    series_a = await _make_series(db_session, project_id, "A")
    series_b = await _make_series(db_session, project_id, "B")
    entry = CodexEntry(
        project_id=project_id,
        series_id=series_a,
        title="Vándorló kódex",
        content="Ugyanaz a szöveg.",
        ai_visible=True,
    )
    db_session.add(entry)
    await db_session.commit()

    router = _mock_router()
    svc = EmbeddingService(router=router)
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    row = await _emb_row(db_session, project_id, "codex")
    assert row.series_id == series_a
    embed_calls = router.embed.await_count

    # Move the entry to series B (content unchanged).
    entry.series_id = series_b
    await db_session.commit()

    result = await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    # Metadata-only update: no re-embed, but the row's series_id is reconciled.
    assert router.embed.await_count == embed_calls
    assert result.indexed == 0
    refreshed = await _emb_row(db_session, project_id, "codex")
    await db_session.refresh(refreshed)
    assert refreshed.series_id == series_b  # NOT stale series_a
    assert result.updated == 1


@pytest.mark.integration
async def test_codex_moved_to_global_clears_series_id(db_session):
    """Moving a series-scoped codex entry to project-global (series_id NULL)
    clears the embedding's series_id on re-sync."""
    project_id = await _make_project(db_session)
    series_a = await _make_series(db_session, project_id, "A")
    entry = CodexEntry(
        project_id=project_id,
        series_id=series_a,
        title="Kódex",
        content="Szöveg.",
        ai_visible=True,
    )
    db_session.add(entry)
    await db_session.commit()

    svc = EmbeddingService(router=_mock_router())
    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)

    entry.series_id = None
    await db_session.commit()

    await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)
    row = await _emb_row(db_session, project_id, "codex")
    await db_session.refresh(row)
    assert row.series_id is None
