"""Integration + service tests for project JSON backup/restore (Feature #5).

Covers the serializer (includes the full graph, EXCLUDES provider secrets /
embeddings / jobs / revisions), the restorer (fresh ids, every FK remapped,
transactional rollback, version/shape validation) and the two endpoints
(download, multipart restore, ownership 404).

The round-trip (seed → export → restore → assert structurally-equivalent copy
with a DIFFERENT id) is the key correctness proof.
"""

import io
import json
import uuid

import pytest
from alexandria_core.models.beat import Beat
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.codex_progression import CodexProgression
from alexandria_core.models.codex_relation import CodexRelation
from alexandria_core.models.embedding import Embedding
from alexandria_core.models.generation_job import GenerationJob
from alexandria_core.models.location import Location
from alexandria_core.models.project import Project
from alexandria_core.models.provider import Provider
from alexandria_core.models.revision import Revision
from alexandria_core.models.scene import Scene
from alexandria_core.models.series import Series
from alexandria_core.models.snippet import Snippet
from alexandria_core.models.style_guide import StyleGuide
from alexandria_core.models.worldbuilding_entry import WorldbuildingEntry
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.backup_service import (
    BackupError,
    export_project,
    restore_project,
)

pytestmark = pytest.mark.integration


async def _seed_rich_project(db: AsyncSession) -> Project:
    """Seed a rich project graph and return the persisted Project.

    Series (1), books (one in-series, one project-only), chapters, scenes (with
    pov + content + summary), beats, codex entry (series-scoped), character,
    location, worldbuilding, snippet, style guide, a codex relation
    (character→location) and a codex progression (character at chapter/scene).
    Also a Provider, an Embedding, a GenerationJob and a Revision — these MUST
    NOT appear in the backup.
    """
    project = Project(title="Eredeti projekt", description="Leírás", language="hu")
    db.add(project)
    await db.flush()

    series = Series(project_id=project.id, title="Sorozat", order_index=0)
    db.add(series)
    await db.flush()

    book_in_series = Book(
        project_id=project.id,
        series_id=series.id,
        title="Könyv a sorozatban",
        language="hu",
        order_index=0,
    )
    book_solo = Book(
        project_id=project.id,
        series_id=None,
        title="Önálló könyv",
        language="hu",
        order_index=1,
    )
    db.add_all([book_in_series, book_solo])
    await db.flush()

    character = Character(
        project_id=project.id, name="Anna", aliases=["A."], role="Hős"
    )
    location = Location(project_id=project.id, name="Vár")
    worldbuilding = WorldbuildingEntry(project_id=project.id, name="Mágia")
    db.add_all([character, location, worldbuilding])
    await db.flush()

    chapter = Chapter(
        book_id=book_in_series.id, title="Első fejezet", summary="Fejezet össz.", order_index=0
    )
    db.add(chapter)
    await db.flush()

    scene = Scene(
        chapter_id=chapter.id,
        title="Első jelenet",
        content="Egy két három.",
        summary="Jelenet össz.",
        order_index=0,
        word_count=3,
        pov_character_id=character.id,
    )
    db.add(scene)
    await db.flush()

    beat = Beat(scene_id=scene.id, description="Beat egy", order_index=0)
    db.add(beat)

    codex_entry = CodexEntry(
        project_id=project.id,
        series_id=series.id,
        title="Kódex elem",
        entry_type="custom",
        content="Tartalom",
        aliases=["alias"],
        tags=["tag"],
    )
    snippet = Snippet(
        project_id=project.id,
        title="Snippet",
        content="Snippet szöveg",
        source_scene_id=scene.id,
        tags=["sn"],
    )
    style_guide = StyleGuide(
        project_id=project.id, tone="komor", pov="E/3", tense="múlt"
    )
    db.add_all([codex_entry, snippet, style_guide])
    await db.flush()

    relation = CodexRelation(
        project_id=project.id,
        from_entity_type="character",
        from_entity_id=character.id,
        to_entity_type="location",
        to_entity_id=location.id,
        relation_type="lakik",
    )
    progression = CodexProgression(
        entity_type="character",
        entity_id=character.id,
        chapter_id=chapter.id,
        scene_id=scene.id,
        note="Állapot",
    )
    db.add_all([relation, progression])

    # --- Excluded-on-purpose rows (secrets / regenerable / transient) ---
    provider = Provider(
        type="openai",
        label="Titkos szolgáltató",
        api_key_encrypted="gAAAAA-secret-ciphertext",
    )
    db.add(provider)
    job = GenerationJob(scene_id=scene.id, job_type="generate", status="done")
    db.add(job)
    revision = Revision(
        scene_id=scene.id, content="Régi verzió", revision_type="generate"
    )
    db.add(revision)
    embedding = Embedding(
        project_id=project.id,
        entity_type="scene",
        entity_id=scene.id,
        content_hash="hash",
        embedding=None,
        model_name="text-embedding-3-small",
    )
    db.add(embedding)

    await db.commit()
    await db.refresh(project)
    return project


# --------------------------------------------------------------------------- #
# Serializer                                                                   #
# --------------------------------------------------------------------------- #


async def test_export_includes_full_graph(db_session: AsyncSession):
    project = await _seed_rich_project(db_session)
    env = await export_project(db_session, project.id)

    assert env["version"] == 1
    assert "exported_at" in env
    assert env["project"]["title"] == "Eredeti projekt"
    assert len(env["series"]) == 1
    assert len(env["books"]) == 2
    assert len(env["chapters"]) == 1
    assert len(env["scenes"]) == 1
    assert env["scenes"][0]["content"] == "Egy két három."
    assert env["scenes"][0]["summary"] == "Jelenet össz."
    assert env["chapters"][0]["summary"] == "Fejezet össz."
    assert len(env["beats"]) == 1
    assert len(env["codex_entries"]) == 1
    assert len(env["characters"]) == 1
    assert len(env["locations"]) == 1
    assert len(env["worldbuilding_entries"]) == 1
    assert len(env["snippets"]) == 1
    assert len(env["style_guides"]) == 1
    assert len(env["codex_relations"]) == 1
    assert len(env["codex_progressions"]) == 1


async def test_export_excludes_secrets_and_transient(db_session: AsyncSession):
    """Providers/embeddings/jobs/revisions must NEVER appear in a backup."""
    project = await _seed_rich_project(db_session)
    env = await export_project(db_session, project.id)

    # No top-level keys for the excluded types.
    assert "providers" not in env
    assert "embeddings" not in env
    assert "generation_jobs" not in env
    assert "revisions" not in env
    assert "ai_comments" not in env

    # And, critically, the secret ciphertext does not appear ANYWHERE in the
    # serialized envelope (defends against an accidental nested leak).
    blob = json.dumps(env)
    assert "secret-ciphertext" not in blob
    assert "api_key" not in blob


async def test_export_unknown_project_raises(db_session: AsyncSession):
    with pytest.raises(BackupError):
        await export_project(db_session, uuid.uuid4())


# --------------------------------------------------------------------------- #
# Restore — fresh ids + FK remap + round-trip                                 #
# --------------------------------------------------------------------------- #


async def test_round_trip_structural_equivalence(db_session: AsyncSession):
    original = await _seed_rich_project(db_session)
    env = await export_project(db_session, original.id)

    restored = await restore_project(db_session, env)

    # A COPY, not a move: new project id, original still present.
    assert restored.id != original.id
    assert (
        await db_session.get(Project, original.id)
    ) is not None

    # Counts match.
    async def count(model, *where):
        return int(
            (
                await db_session.execute(
                    select(func.count()).select_from(model).where(*where)
                )
            ).scalar_one()
        )

    r_books = (
        await db_session.execute(select(Book).where(Book.project_id == restored.id))
    ).scalars().all()
    assert len(r_books) == 2

    # book.series_id remapped to the RESTORED series (not the original).
    r_series = (
        await db_session.execute(
            select(Series).where(Series.project_id == restored.id)
        )
    ).scalars().all()
    assert len(r_series) == 1
    restored_series_id = r_series[0].id
    in_series = [b for b in r_books if b.series_id is not None]
    solo = [b for b in r_books if b.series_id is None]
    assert len(in_series) == 1 and len(solo) == 1
    assert in_series[0].series_id == restored_series_id
    # Not pointing at the original series.
    assert in_series[0].series_id != env["series"][0]["id"]

    # Chapter under the restored in-series book.
    r_chapters = (
        await db_session.execute(
            select(Chapter).where(Chapter.book_id == in_series[0].id)
        )
    ).scalars().all()
    assert len(r_chapters) == 1
    assert r_chapters[0].summary == "Fejezet össz."

    # Scene under the restored chapter; content/summary preserved.
    r_scenes = (
        await db_session.execute(
            select(Scene).where(Scene.chapter_id == r_chapters[0].id)
        )
    ).scalars().all()
    assert len(r_scenes) == 1
    scene = r_scenes[0]
    assert scene.content == "Egy két három."
    assert scene.summary == "Jelenet össz."

    # scene.pov_character_id points at the RESTORED character.
    r_characters = (
        await db_session.execute(
            select(Character).where(Character.project_id == restored.id)
        )
    ).scalars().all()
    assert len(r_characters) == 1
    assert scene.pov_character_id == r_characters[0].id
    assert scene.pov_character_id != original.id  # sanity

    # Beat under the restored scene.
    assert await count(Beat, Beat.scene_id == scene.id) == 1

    # Codex entry series_id remapped to restored series.
    r_codex = (
        await db_session.execute(
            select(CodexEntry).where(CodexEntry.project_id == restored.id)
        )
    ).scalars().all()
    assert len(r_codex) == 1
    assert r_codex[0].series_id == restored_series_id

    # Codex relation endpoints remapped to restored character + location.
    r_loc = (
        await db_session.execute(
            select(Location).where(Location.project_id == restored.id)
        )
    ).scalars().all()
    r_rel = (
        await db_session.execute(
            select(CodexRelation).where(CodexRelation.project_id == restored.id)
        )
    ).scalars().all()
    assert len(r_rel) == 1
    assert r_rel[0].from_entity_id == r_characters[0].id
    assert r_rel[0].to_entity_id == r_loc[0].id

    # Codex progression entity/chapter/scene remapped.
    r_prog = (
        await db_session.execute(
            select(CodexProgression).where(
                CodexProgression.scene_id == scene.id
            )
        )
    ).scalars().all()
    assert len(r_prog) == 1
    assert r_prog[0].entity_id == r_characters[0].id
    assert r_prog[0].chapter_id == r_chapters[0].id

    # Snippet source_scene_id remapped to restored scene.
    r_snip = (
        await db_session.execute(
            select(Snippet).where(Snippet.project_id == restored.id)
        )
    ).scalars().all()
    assert len(r_snip) == 1
    assert r_snip[0].source_scene_id == scene.id

    # Style guide carried over.
    assert (
        await count(StyleGuide, StyleGuide.project_id == restored.id)
    ) == 1


async def test_restore_unknown_version_raises(db_session: AsyncSession):
    with pytest.raises(BackupError):
        await restore_project(
            db_session, {"version": 999, "project": {"title": "x"}}
        )


async def test_restore_malformed_payload_raises(db_session: AsyncSession):
    # Missing the project object entirely.
    with pytest.raises(BackupError):
        await restore_project(db_session, {"version": 1, "series": []})
    # Not even a dict.
    with pytest.raises(BackupError):
        await restore_project(db_session, ["not", "a", "dict"])
    # A collection that is not a list.
    with pytest.raises(BackupError):
        await restore_project(
            db_session,
            {"version": 1, "project": {"title": "x"}, "books": "nope"},
        )


async def test_restore_is_transactional_no_orphan(db_session: AsyncSession):
    """A failure mid-restore rolls back — no orphan project survives."""
    before = int(
        (
            await db_session.execute(select(func.count()).select_from(Project))
        ).scalar_one()
    )

    # A book row missing the required 'title' key triggers a KeyError mid-build
    # AFTER the project + flush. The restore must roll back the whole thing.
    bad_payload = {
        "version": 1,
        "project": {"title": "Félbe maradt"},
        "books": [{"id": str(uuid.uuid4())}],  # no 'title' -> KeyError
    }
    with pytest.raises(KeyError):
        await restore_project(db_session, bad_payload)

    after = int(
        (
            await db_session.execute(select(func.count()).select_from(Project))
        ).scalar_one()
    )
    assert after == before
    # The half-built project must not be queryable by title.
    leaked = (
        await db_session.execute(
            select(Project).where(Project.title == "Félbe maradt")
        )
    ).scalars().all()
    assert leaked == []


# --------------------------------------------------------------------------- #
# Endpoints                                                                    #
# --------------------------------------------------------------------------- #


async def test_backup_endpoint_downloads_json(
    client, auth_headers, db_session
):
    project = await _seed_rich_project(db_session)
    resp = await client.get(
        f"/api/v1/projects/{project.id}/backup", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    assert "attachment" in resp.headers["content-disposition"]
    assert "backup.json" in resp.headers["content-disposition"]
    env = resp.json()
    assert env["version"] == 1
    assert env["project"]["title"] == "Eredeti projekt"
    # No secret in the downloaded body.
    assert "secret-ciphertext" not in resp.text


async def test_backup_endpoint_unknown_project_404(client, auth_headers):
    resp = await client.get(
        f"/api/v1/projects/{uuid.uuid4()}/backup", headers=auth_headers
    )
    assert resp.status_code == 404


async def test_backup_endpoint_requires_auth(client, db_session):
    project = await _seed_rich_project(db_session)
    resp = await client.get(f"/api/v1/projects/{project.id}/backup")
    assert resp.status_code == 401


async def test_restore_endpoint_round_trip(client, auth_headers, db_session):
    project = await _seed_rich_project(db_session)
    backup_resp = await client.get(
        f"/api/v1/projects/{project.id}/backup", headers=auth_headers
    )
    assert backup_resp.status_code == 200
    backup_bytes = backup_resp.content

    files = {"file": ("backup.json", io.BytesIO(backup_bytes), "application/json")}
    resp = await client.post(
        "/api/v1/projects/restore", headers=auth_headers, files=files
    )
    assert resp.status_code == 201
    summary = resp.json()
    assert summary["project_id"] != str(project.id)
    assert summary["title"] == "Eredeti projekt"
    assert summary["book_count"] == 2
    assert summary["series_count"] == 1
    assert summary["chapter_count"] == 1
    assert summary["scene_count"] == 1
    assert summary["beat_count"] == 1
    assert summary["codex_entry_count"] == 1
    assert summary["character_count"] == 1
    assert summary["codex_relation_count"] == 1
    assert summary["codex_progression_count"] == 1


async def test_restore_endpoint_invalid_json_400(client, auth_headers):
    files = {"file": ("x.json", io.BytesIO(b"not json {"), "application/json")}
    resp = await client.post(
        "/api/v1/projects/restore", headers=auth_headers, files=files
    )
    assert resp.status_code == 400


async def test_restore_endpoint_empty_file_400(client, auth_headers):
    files = {"file": ("x.json", io.BytesIO(b""), "application/json")}
    resp = await client.post(
        "/api/v1/projects/restore", headers=auth_headers, files=files
    )
    assert resp.status_code == 400


async def test_restore_endpoint_bad_version_422(client, auth_headers):
    payload = json.dumps({"version": 999, "project": {"title": "x"}}).encode()
    files = {"file": ("x.json", io.BytesIO(payload), "application/json")}
    resp = await client.post(
        "/api/v1/projects/restore", headers=auth_headers, files=files
    )
    assert resp.status_code == 422


async def test_restore_endpoint_oversize_413(client, auth_headers, monkeypatch):
    """An upload over the cap is rejected with 413 (P1 OOM guard). The cap is
    monkeypatched down so the test body stays small but proves the contract:
    a body exceeding the cap aborts with 413, never reaching JSON parsing."""
    monkeypatch.setattr("app.api.v1.backups._MAX_UPLOAD_BYTES", 1024)
    oversize = b"x" * 5000  # 5x the (patched) 1 KiB cap
    files = {"file": ("big.json", io.BytesIO(oversize), "application/json")}
    resp = await client.post(
        "/api/v1/projects/restore", headers=auth_headers, files=files
    )
    assert resp.status_code == 413


async def test_restore_endpoint_requires_auth(client):
    payload = json.dumps({"version": 1, "project": {"title": "x"}}).encode()
    files = {"file": ("x.json", io.BytesIO(payload), "application/json")}
    resp = await client.post("/api/v1/projects/restore", files=files)
    assert resp.status_code == 401
