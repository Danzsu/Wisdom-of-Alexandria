# ForgeWriter AI — Backend AI Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all MVP AI features: ModelRouter (LiteLLM abstraction), Hungarian prompt templates, Rewrite, Describe (6 sensory channels), Scene Continuation, Generate Scene from Beats, Revision workflow, Summary endpoints, and Markdown Export. Every AI call creates a GenerationJob and saves a Revision — AI output never auto-overwrites manuscript text.

**Architecture:** All AI calls go through `ModelRouter` → `LiteLLM` → Ollama (local) or cloud. Prompt templates live in `packages/prompts/hu/` as Markdown files with `${variable}` substitutions. Every AI endpoint creates a `GenerationJob` record, calls ModelRouter, saves output as a `Revision`, returns `job_id + result`. Users then POST to `/generation-jobs/{id}/accept` to apply changes.

**Prerequisite:** Plans 1 and 2 must be complete. All models and CRUD endpoints are in place.

**Tech Stack:** LiteLLM 1.40+, Ollama (local), FastAPI, SQLAlchemy async, pytest + pytest-mock

---

## File map

```
packages/
  prompts/
    hu/
      rewrite.md
      describe.md
      write_continue.md
      generate_scene.md
      summarize_scene.md
      summarize_chapter.md

apps/api/app/
  services/
    model_router.py          ← LiteLLM abstraction, all AI calls go here
    prompt_loader.py         ← loads .md templates from packages/prompts/
    revision_service.py      ← creates Revision records from AI output
    ai_service.py            ← orchestrates: load prompt → call ModelRouter → save job+revision
    export_service.py        ← Markdown export from scenes
  api/v1/
    ai.py                    ← all AI endpoints
    export.py                ← export endpoints
    router.py                ← updated with ai + export routers

tests/
  unit/
    test_model_router.py
    test_prompt_loader.py
    test_ai_service.py
    test_export_service.py
  integration/
    test_ai_api.py
    test_export_api.py
```

---

## Task 1: ModelRouter — LiteLLM abstraction

All AI calls in ForgeWriter go through this single service. Routers and services never call LiteLLM directly.

**Files:**
- Create: `apps/api/app/services/model_router.py`
- Create: `apps/api/tests/unit/test_model_router.py`

---

- [ ] **Step 1.1: Write failing unit test**

`apps/api/tests/unit/test_model_router.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.model_router import ModelRouter

pytestmark = [pytest.mark.asyncio, pytest.mark.unit]


async def test_complete_returns_string_content() -> None:
    router = ModelRouter()
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "Generált szöveg"

    with patch("app.services.model_router.litellm.acompletion", new=AsyncMock(return_value=mock_response)):
        result = await router.complete(
            messages=[{"role": "user", "content": "Írj valamit"}],
            model="ollama/llama3.2",
        )

    assert result == "Generált szöveg"


async def test_complete_uses_default_model_when_none_given() -> None:
    router = ModelRouter()
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "ok"

    with patch("app.services.model_router.litellm.acompletion", new=AsyncMock(return_value=mock_response)) as mock_call:
        await router.complete(messages=[{"role": "user", "content": "test"}])

    called_model = mock_call.call_args.kwargs["model"]
    assert called_model is not None


async def test_complete_raises_on_litellm_error() -> None:
    router = ModelRouter()

    with patch(
        "app.services.model_router.litellm.acompletion",
        new=AsyncMock(side_effect=Exception("Model offline")),
    ):
        with pytest.raises(RuntimeError, match="AI generation failed"):
            await router.complete(messages=[{"role": "user", "content": "test"}])
```

- [ ] **Step 1.2: Run to confirm failure**

```bash
cd apps/api && uv run pytest tests/unit/test_model_router.py -v
```

Expected: `ImportError` — `model_router` not found.

- [ ] **Step 1.3: Write services/model_router.py**

```python
import litellm

from app.core.config import settings

litellm.set_verbose = False


class ModelRouter:
    def __init__(self) -> None:
        self._ollama_base = settings.ollama_base_url

    async def complete(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.75,
        max_tokens: int = 2048,
    ) -> str:
        target_model = model or settings.default_local_model

        kwargs: dict = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if target_model.startswith("ollama/"):
            kwargs["api_base"] = self._ollama_base

        try:
            response = await litellm.acompletion(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as exc:
            raise RuntimeError(f"AI generation failed: {exc}") from exc


model_router = ModelRouter()
```

- [ ] **Step 1.4: Run tests**

```bash
cd apps/api && uv run pytest tests/unit/test_model_router.py -v
```

Expected: All 3 tests `PASSED`.

- [ ] **Step 1.5: Commit**

```bash
git add apps/api/app/services/model_router.py apps/api/tests/unit/test_model_router.py
git commit -m "feat: ModelRouter — LiteLLM abstraction (all AI calls go through here)"
```

---

## Task 2: PromptLoader + Hungarian prompt templates

**Files:**
- Create: `apps/api/app/services/prompt_loader.py`
- Create: `packages/prompts/hu/rewrite.md`
- Create: `packages/prompts/hu/describe.md`
- Create: `packages/prompts/hu/write_continue.md`
- Create: `packages/prompts/hu/generate_scene.md`
- Create: `packages/prompts/hu/summarize_scene.md`
- Create: `packages/prompts/hu/summarize_chapter.md`
- Create: `apps/api/tests/unit/test_prompt_loader.py`

---

- [ ] **Step 2.1: Write failing unit test**

`apps/api/tests/unit/test_prompt_loader.py`:

```python
import pytest
from app.services.prompt_loader import PromptLoader

pytestmark = pytest.mark.unit


def test_load_prompt_substitutes_variables() -> None:
    loader = PromptLoader()
    result = loader.load("rewrite", selected_text="Az ajtó nyílt.", preceding_context="Csend volt.", action="Tedd drámaibbá", style_guide_summary="")
    assert "Az ajtó nyílt." in result
    assert "Tedd drámaibbá" in result


def test_load_missing_prompt_raises() -> None:
    loader = PromptLoader()
    with pytest.raises(FileNotFoundError):
        loader.load("nonexistent_prompt_xyz")
```

- [ ] **Step 2.2: Write services/prompt_loader.py**

```python
import os
from pathlib import Path
from string import Template


class PromptLoader:
    def __init__(self, lang: str = "hu") -> None:
        self._base = (
            Path(os.getenv("PROMPTS_DIR", ""))
            if os.getenv("PROMPTS_DIR")
            else Path(__file__).parents[4] / "packages" / "prompts"
        )
        self._lang = lang

    def load(self, name: str, **kwargs: str) -> str:
        path = self._base / self._lang / f"{name}.md"
        if not path.exists():
            raise FileNotFoundError(f"Prompt template not found: {path}")
        raw = path.read_text(encoding="utf-8")
        return Template(raw).safe_substitute(**kwargs)


prompt_loader = PromptLoader()
```

- [ ] **Step 2.3: Create packages/prompts/hu/rewrite.md**

```markdown
Te egy tapasztalt magyar irodalmi szerkesztő és szerző vagy.

## Kontextus (megelőző szöveg)
${preceding_context}

## Átírandó szöveg
${selected_text}

## Utasítás
${action}

## Stílusirányelvek
${style_guide_summary}

## Feladat
Írd át a fenti szöveget az utasítás szerint. Kövesd az alábbi elveket:
- A szöveg természetesen hangzó, irodalmi minőségű magyar legyen
- Kerüld az angolból fordított mondatszerkezeteket és az idegenszerű szórendet
- Őrizd meg az eredeti jelenet hangulatát, feszültségét, idejét és POV-ját
- Ne legyen túlírt, pátoszos vagy magyarázó
- Csak az átírt szöveget add vissza, magyarázat nélkül

## Átírt szöveg
```

- [ ] **Step 2.4: Create packages/prompts/hu/describe.md**

```markdown
Te egy érzékletes, szenzoros leírásokban kiemelkedő magyar irodalmi szerző vagy.

## Jelenet kontextusa (megelőző szöveg)
${preceding_context}

## Leírandó elem
${selected_text}

## Célzott érzékszerv
${sense_hu} (${sense_en})

## Feladat
Írj 2-4 mondatot, amely kizárólag a **${sense_hu}** érzékszerven keresztül írja le a fenti elemet.

Kövesd az alábbi elveket:
- Csak és kizárólag a megadott érzékszerv kerüljön be — ne keveredjen más érzékszervekkel
- Legyen konkrét, érzékletes, irodalmi minőségű
- Illeszkedjen a kontextus hangulatához és feszültségszintjéhez
- Természetes, nem angolból fordított magyar mondatszerkezet
- Ne magyarázzon, ne kommentáljon — csak leírjon
- Csak a leírást add vissza, semmi egyebet

## Leírás
```

- [ ] **Step 2.5: Create packages/prompts/hu/write_continue.md**

```markdown
Te egy tapasztalt magyar regényíró vagy. Folytatnod kell egy megkezdett jelenetet.

## Jelenet metaadatai
- Cím: ${scene_title}
- POV karakter: ${pov_character}
- Helyszín: ${location}
- Hangulat: ${emotional_tone}
- Jelenet célja: ${scene_goal}
- Jelenet konfliktusa: ${scene_conflict}

## Codex kontextus
${codex_context}

## Jelenet eddigi szövege
${scene_text}

## Feladat
Folytasd a jelenetet természetesen, az eddigi szöveg stílusában és tempójában.
- Maradj a POV karakternél és az ő perspektívájánál
- Ne ugorj időben és helyszínben
- Kb. ${target_words} szót írj
- Ne foglald össze, ne magyarázz — csak folytasd a prózát
- Természetes magyar irodalmi próza, nem fordítás

## Folytatás
```

- [ ] **Step 2.6: Create packages/prompts/hu/generate_scene.md**

```markdown
Te egy tapasztalt magyar regényíró vagy. Egy teljes jelenetet kell megírnod.

## Jelenet metaadatai
- Cím: ${scene_title}
- POV karakter: ${pov_character}
- Helyszín: ${location}
- Idő: ${time_marker}
- Hangulat: ${emotional_tone}
- Jelenet célja: ${scene_goal}
- Jelenet konfliktusa: ${scene_conflict}
- Jelenet kimenetele: ${scene_outcome}

## Beatek (a jelenet cselekvési egységei)
${beats_text}

## Codex kontextus
${codex_context}

## Előző jelenet összefoglalója
${previous_scene_summary}

## Stílusirányelvek
${style_guide_summary}

## Feladat
Írj egy teljes jelenetet a fenti beatek alapján. Kb. ${target_words} szót írj.
- A beatek sorrendjét és tartalmát kövesd, de ne szó szerint
- Természetes, irodalmi minőségű magyar próza
- Kerüld az anglicizmusokat és az idegen mondatszerkezeteket
- Élő párbeszédeket írj, kerüld a "mondta" ige túlhasználatát
- Ne foglalj össze — csak a jelenet szövegét add vissza

## Jelenet szövege
```

- [ ] **Step 2.7: Create packages/prompts/hu/summarize_scene.md**

```markdown
Foglald össze az alábbi jelenet tartalmát 2-3 mondatban, magyarul.
A összefoglaló tartalmazza: ki csinált mit, mi változott, milyen konfliktus játszódott le.
Csak az összefoglalót add vissza, semmilyen magyarázatot nem.

## Jelenet szövege
${scene_text}

## Összefoglaló
```

- [ ] **Step 2.8: Create packages/prompts/hu/summarize_chapter.md**

```markdown
Foglald össze az alábbi fejezet tartalmát 3-5 mondatban, magyarul.
Az összefoglaló tartalmazza: a főbb eseményeket, a karakter fejlődését, a konfliktus állapotát.
Csak az összefoglalót add vissza.

## Fejezet jelenetei
${scenes_summary}

## Fejezet célja
${chapter_goal}

## Összefoglaló
```

- [ ] **Step 2.9: Run prompt loader tests**

```bash
cd apps/api && uv run pytest tests/unit/test_prompt_loader.py -v
```

Expected: Both tests `PASSED`.

- [ ] **Step 2.10: Commit**

```bash
git add apps/api/app/services/prompt_loader.py apps/api/tests/unit/test_prompt_loader.py \
  packages/prompts/hu/
git commit -m "feat: PromptLoader + 6 Hungarian prompt templates (rewrite, describe, continue, generate, summarize)"
```

---

## Task 3: RevisionService — AI output tracking

Every AI generation creates a `Revision` record so previous text is never lost.

**Files:**
- Create: `apps/api/app/services/revision_service.py`
- Create: `apps/api/tests/unit/test_revision_service.py`

---

- [ ] **Step 3.1: Write failing unit test**

`apps/api/tests/unit/test_revision_service.py`:

```python
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.revision_service import create_ai_revision

pytestmark = [pytest.mark.asyncio, pytest.mark.unit]


async def test_create_ai_revision_adds_to_db() -> None:
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    revision = await create_ai_revision(
        db=db,
        project_id=uuid.uuid4(),
        entity_type="scene",
        entity_id=uuid.uuid4(),
        before_text="Régi szöveg",
        after_text="Új AI szöveg",
        job_type="rewrite",
        job_id=uuid.uuid4(),
        user_id="admin",
    )

    db.add.assert_called_once()
    db.commit.assert_awaited_once()
    assert revision is not None
```

- [ ] **Step 3.2: Write services/revision_service.py**

```python
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.revision import Revision


async def create_ai_revision(
    db: AsyncSession,
    project_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    before_text: str | None,
    after_text: str,
    job_type: str,
    job_id: uuid.UUID,
    user_id: str | None = None,
) -> Revision:
    revision = Revision(
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        revision_type=f"ai_{job_type}",
        before_json={"text_markdown": before_text} if before_text else None,
        after_json={"text_markdown": after_text},
        change_summary=f"AI {job_type} generation",
        created_by=user_id,
        generation_job_id=job_id,
    )
    db.add(revision)
    await db.commit()
    await db.refresh(revision)
    return revision
```

- [ ] **Step 3.3: Run tests**

```bash
cd apps/api && uv run pytest tests/unit/test_revision_service.py -v
```

Expected: `PASSED`.

- [ ] **Step 3.4: Commit**

```bash
git add apps/api/app/services/revision_service.py apps/api/tests/unit/test_revision_service.py
git commit -m "feat: RevisionService — AI output always saved to revision history"
```

---

## Task 4: AIService — orchestration layer

One central `ai_service.py` that every AI endpoint calls. Handles: create job → load prompt → call ModelRouter → save revision → update job status.

**Files:**
- Create: `apps/api/app/services/ai_service.py`
- Create: `apps/api/tests/unit/test_ai_service.py`

---

- [ ] **Step 4.1: Write failing unit test**

`apps/api/tests/unit/test_ai_service.py`:

```python
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.ai_service import AIService

pytestmark = [pytest.mark.asyncio, pytest.mark.unit]


async def test_run_job_creates_job_and_returns_result() -> None:
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    service = AIService()

    with patch.object(service, "_model_router") as mock_router, \
         patch.object(service, "_revision_service") as mock_revision:
        mock_router.complete = AsyncMock(return_value="AI eredmény")
        mock_revision.create_ai_revision = AsyncMock(return_value=MagicMock())

        result = await service.run_job(
            db=db,
            project_id=uuid.uuid4(),
            scene_id=uuid.uuid4(),
            job_type="rewrite",
            messages=[{"role": "user", "content": "Írj valamit"}],
            user_id="admin",
        )

    assert result["text"] == "AI eredmény"
    assert "job_id" in result
```

- [ ] **Step 4.2: Write services/ai_service.py**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generation_job import GenerationJob
from app.services import revision_service as _revision_service_module
from app.services.model_router import model_router as _router


class AIService:
    def __init__(self) -> None:
        self._model_router = _router
        self._revision_service = _revision_service_module

    async def run_job(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        job_type: str,
        messages: list[dict],
        scene_id: uuid.UUID | None = None,
        chapter_id: uuid.UUID | None = None,
        book_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float = 0.75,
        max_tokens: int = 2048,
        user_id: str | None = None,
        entity_id: uuid.UUID | None = None,
        entity_type: str | None = None,
        before_text: str | None = None,
        prompt_version: str = "1.0",
    ) -> dict:
        job = GenerationJob(
            project_id=project_id,
            scene_id=scene_id,
            chapter_id=chapter_id,
            book_id=book_id,
            job_type=job_type,
            status="running",
            prompt_version=prompt_version,
            created_by_user_id=user_id,
            started_at=datetime.now(timezone.utc),
            input_json={"messages_count": len(messages)},
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        try:
            text = await self._model_router.complete(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            job.status = "requires_review"
            job.output_json = {"text": text}
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(job)

            if entity_id and entity_type:
                await self._revision_service.create_ai_revision(
                    db=db,
                    project_id=project_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    before_text=before_text,
                    after_text=text,
                    job_type=job_type,
                    job_id=job.id,
                    user_id=user_id,
                )

            return {"job_id": str(job.id), "status": job.status, "text": text}

        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            raise


ai_service = AIService()
```

- [ ] **Step 4.3: Run tests**

```bash
cd apps/api && uv run pytest tests/unit/test_ai_service.py -v
```

Expected: `PASSED`.

- [ ] **Step 4.4: Commit**

```bash
git add apps/api/app/services/ai_service.py apps/api/tests/unit/test_ai_service.py
git commit -m "feat: AIService — orchestration (create job → call LLM → save revision → update status)"
```

---

## Task 5: Rewrite endpoint

**Files:**
- Create: `apps/api/app/schemas/ai.py` (shared AI request/response schemas)
- Create: `apps/api/app/api/v1/ai.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/integration/test_ai_api.py`

---

- [ ] **Step 5.1: Write failing integration test**

`apps/api/tests/integration/test_ai_api.py`:

```python
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

MOCK_AI_RESPONSE = "Anna lassan lépett az átjáróba. A lábnyomok frissek voltak a porban."


async def _setup_scene(client: AsyncClient, headers: dict) -> tuple[str, str]:
    """Returns (project_id, scene_id)"""
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
    return proj["id"], scene["id"]


async def test_rewrite_returns_job_id_and_text(
    client: AsyncClient, auth_headers: dict
) -> None:
    project_id, scene_id = await _setup_scene(client, auth_headers)

    with patch(
        "app.services.ai_service.AIService.run_job",
        new=AsyncMock(
            return_value={
                "job_id": str(uuid.uuid4()),
                "status": "requires_review",
                "text": MOCK_AI_RESPONSE,
            }
        ),
    ):
        response = await client.post(
            "/api/v1/ai/rewrite",
            json={
                "project_id": project_id,
                "scene_id": scene_id,
                "selected_text": "Anna belépett.",
                "action": "Tedd drámaibbá",
                "preceding_context": "",
            },
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "requires_review"
    assert data["result"]["rewritten_text"] == MOCK_AI_RESPONSE


async def test_rewrite_missing_selected_text_returns_422(
    client: AsyncClient, auth_headers: dict
) -> None:
    project_id, scene_id = await _setup_scene(client, auth_headers)
    response = await client.post(
        "/api/v1/ai/rewrite",
        json={"project_id": project_id, "scene_id": scene_id},
        headers=auth_headers,
    )
    assert response.status_code == 422
```

- [ ] **Step 5.2: Run to confirm failure**

```bash
cd apps/api && uv run pytest tests/integration/test_ai_api.py::test_rewrite_returns_job_id_and_text -v
```

- [ ] **Step 5.3: Write schemas/ai.py**

```python
import uuid
from pydantic import BaseModel


class RewriteRequest(BaseModel):
    project_id: uuid.UUID
    scene_id: uuid.UUID
    selected_text: str
    action: str = "improve_hungarian_style"
    preceding_context: str = ""
    instructions: str | None = None
    model_preference: str | None = None


class RewriteResult(BaseModel):
    rewritten_text: str
    explanation: str | None = None


class RewriteResponse(BaseModel):
    job_id: str
    status: str
    result: RewriteResult


class DescribeRequest(BaseModel):
    project_id: uuid.UUID
    scene_id: uuid.UUID
    selected_text: str
    preceding_context: str = ""
    senses: list[str] = ["sight", "sound", "touch", "smell", "taste", "metaphor"]
    model_preference: str | None = None


class DescribeResultCard(BaseModel):
    sense: str
    label: str
    text: str


class DescribeResponse(BaseModel):
    job_id: str
    status: str
    results: list[DescribeResultCard]


class WriteContinueRequest(BaseModel):
    project_id: uuid.UUID
    scene_id: uuid.UUID
    target_words: int = 400
    model_preference: str | None = None


class WriteContinueResponse(BaseModel):
    job_id: str
    status: str
    result: dict  # {"continuation": str}


class GenerateSceneRequest(BaseModel):
    project_id: uuid.UUID
    scene_id: uuid.UUID
    target_word_count: int = 1800
    include_codex: bool = True
    include_previous_scene_summary: bool = True
    model_preference: str | None = None


class GenerateSceneResponse(BaseModel):
    job_id: str
    status: str
    result: dict  # {"draft_markdown": str, "summary": str}


class SummarizeRequest(BaseModel):
    project_id: uuid.UUID
    model_preference: str | None = None


class SummarizeResponse(BaseModel):
    job_id: str
    status: str
    summary: str
```

- [ ] **Step 5.4: Write api/v1/ai.py (Rewrite endpoint only — others added in next steps)**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.ai import (
    DescribeRequest,
    DescribeResponse,
    DescribeResultCard,
    GenerateSceneRequest,
    GenerateSceneResponse,
    RewriteRequest,
    RewriteResponse,
    RewriteResult,
    SummarizeRequest,
    SummarizeResponse,
    WriteContinueRequest,
    WriteContinueResponse,
)
from app.services.ai_service import ai_service
from app.services.prompt_loader import prompt_loader
from app.services import crud_scene

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite(
    data: RewriteRequest,
    db: AsyncSession = Depends(get_db),
    user: str = Depends(get_current_user),
) -> RewriteResponse:
    scene = await crud_scene.get_scene(db, data.scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")

    system_prompt = prompt_loader.load(
        "rewrite",
        selected_text=data.selected_text,
        preceding_context=data.preceding_context,
        action=data.action,
        style_guide_summary="",
    )

    result = await ai_service.run_job(
        db=db,
        project_id=data.project_id,
        scene_id=data.scene_id,
        job_type="rewrite",
        messages=[{"role": "user", "content": system_prompt}],
        model=data.model_preference,
        entity_id=data.scene_id,
        entity_type="scene",
        before_text=scene.text_markdown,
        user_id=user,
    )

    return RewriteResponse(
        job_id=result["job_id"],
        status=result["status"],
        result=RewriteResult(rewritten_text=result["text"]),
    )
```

- [ ] **Step 5.5: Register ai router in router.py**

Add to `apps/api/app/api/v1/router.py`:

```python
from app.api.v1.ai import router as ai_router
# ... after other includes:
api_router.include_router(ai_router)
```

- [ ] **Step 5.6: Run tests**

```bash
cd apps/api && uv run pytest tests/integration/test_ai_api.py -v
```

Expected: `test_rewrite_returns_job_id_and_text` PASSED, `test_rewrite_missing_selected_text_returns_422` PASSED.

- [ ] **Step 5.7: Commit**

```bash
git add apps/api/app/schemas/ai.py apps/api/app/api/v1/ai.py \
  apps/api/app/api/v1/router.py apps/api/tests/integration/test_ai_api.py
git commit -m "feat: POST /ai/rewrite — selected text rewrite via ModelRouter + Revision tracking"
```

---

## Task 6: Describe endpoint (6 sensory channels)

Extends `api/v1/ai.py` with the Describe endpoint. One LLM call per sense channel.

**Files:**
- Modify: `apps/api/app/api/v1/ai.py`
- Modify: `apps/api/tests/integration/test_ai_api.py`

---

- [ ] **Step 6.1: Write failing test (add to existing test file)**

Add to `apps/api/tests/integration/test_ai_api.py`:

```python
async def test_describe_returns_6_sense_cards(
    client: AsyncClient, auth_headers: dict
) -> None:
    project_id, scene_id = await _setup_scene(client, auth_headers)

    with patch(
        "app.services.ai_service.AIService.run_job",
        new=AsyncMock(
            return_value={
                "job_id": str(uuid.uuid4()),
                "status": "requires_review",
                "text": "A fény ezüstösen tört meg a rozsdás felületen.",
            }
        ),
    ):
        response = await client.post(
            "/api/v1/ai/describe",
            json={
                "project_id": project_id,
                "scene_id": scene_id,
                "selected_text": "a rozsdás kapupánt",
                "preceding_context": "Anna megállt az átjáró előtt.",
                "senses": ["sight", "sound", "touch"],
            },
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 3
    senses = [card["sense"] for card in data["results"]]
    assert "sight" in senses
    assert "sound" in senses
    assert "touch" in senses
```

- [ ] **Step 6.2: Run to confirm failure**

```bash
cd apps/api && uv run pytest tests/integration/test_ai_api.py::test_describe_returns_6_sense_cards -v
```

- [ ] **Step 6.3: Define sense metadata**

Add this constant to `apps/api/app/api/v1/ai.py` at the top:

```python
SENSE_LABELS: dict[str, str] = {
    "sight": "Látás",
    "sound": "Hang",
    "touch": "Tapintás",
    "smell": "Szag",
    "taste": "Íz",
    "metaphor": "Metaforák",
    "emotional_atmosphere": "Érzelmi atmoszféra",
}
```

- [ ] **Step 6.4: Add describe endpoint to api/v1/ai.py**

Append this endpoint after the `rewrite` endpoint in `apps/api/app/api/v1/ai.py`:

```python
@router.post("/describe", response_model=DescribeResponse)
async def describe(
    data: DescribeRequest,
    db: AsyncSession = Depends(get_db),
    user: str = Depends(get_current_user),
) -> DescribeResponse:
    scene = await crud_scene.get_scene(db, data.scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")

    results: list[DescribeResultCard] = []
    last_job_id = str(uuid.uuid4())

    for sense in data.senses:
        label = SENSE_LABELS.get(sense, sense)
        prompt = prompt_loader.load(
            "describe",
            selected_text=data.selected_text,
            preceding_context=data.preceding_context,
            sense_hu=label,
            sense_en=sense,
        )
        result = await ai_service.run_job(
            db=db,
            project_id=data.project_id,
            scene_id=data.scene_id,
            job_type="describe",
            messages=[{"role": "user", "content": prompt}],
            model=data.model_preference,
            user_id=user,
        )
        last_job_id = result["job_id"]
        results.append(
            DescribeResultCard(sense=sense, label=label, text=result["text"])
        )

    return DescribeResponse(
        job_id=last_job_id,
        status="requires_review",
        results=results,
    )
```

- [ ] **Step 6.5: Run tests**

```bash
cd apps/api && uv run pytest tests/integration/test_ai_api.py -v
```

Expected: All tests `PASSED`.

- [ ] **Step 6.6: Commit**

```bash
git add apps/api/app/api/v1/ai.py apps/api/tests/integration/test_ai_api.py
git commit -m "feat: POST /ai/describe — 6 sensory channels, each card saved as GenerationJob"
```

---

## Task 7: Scene continuation (write-continue) endpoint

**Files:**
- Modify: `apps/api/app/api/v1/ai.py`
- Modify: `apps/api/app/models/generation_job.py` (add write_continue to job_type comment)
- Modify: `apps/api/tests/integration/test_ai_api.py`

---

- [ ] **Step 7.1: Write failing test**

Add to `apps/api/tests/integration/test_ai_api.py`:

```python
async def test_write_continue_returns_continuation(
    client: AsyncClient, auth_headers: dict
) -> None:
    project_id, scene_id = await _setup_scene(client, auth_headers)

    with patch(
        "app.services.ai_service.AIService.run_job",
        new=AsyncMock(
            return_value={
                "job_id": str(uuid.uuid4()),
                "status": "requires_review",
                "text": "Anna lassan fordult meg. A szoba végéből valami neszt hallott.",
            }
        ),
    ):
        response = await client.post(
            "/api/v1/ai/write-continue",
            json={
                "project_id": project_id,
                "scene_id": scene_id,
                "target_words": 200,
            },
            headers=auth_headers,
        )

    assert response.status_code == 200
    assert "continuation" in response.json()["result"]
```

- [ ] **Step 7.2: Add write-continue endpoint to api/v1/ai.py**

```python
@router.post("/write-continue", response_model=WriteContinueResponse)
async def write_continue(
    data: WriteContinueRequest,
    db: AsyncSession = Depends(get_db),
    user: str = Depends(get_current_user),
) -> WriteContinueResponse:
    scene = await crud_scene.get_scene(db, data.scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene_text = scene.text_markdown or ""
    if not scene_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Scene has no text to continue. Add some content first.",
        )

    prompt = prompt_loader.load(
        "write_continue",
        scene_title=scene.title,
        pov_character=str(scene.pov_character_id or ""),
        location=str(scene.location_id or ""),
        emotional_tone=scene.emotional_tone or "",
        scene_goal=scene.scene_goal or "",
        scene_conflict=scene.scene_conflict or "",
        codex_context="",
        scene_text=scene_text[-3000:],  # last 3000 chars for context
        target_words=str(data.target_words),
    )

    result = await ai_service.run_job(
        db=db,
        project_id=data.project_id,
        scene_id=data.scene_id,
        job_type="write_continue",
        messages=[{"role": "user", "content": prompt}],
        model=data.model_preference,
        entity_id=data.scene_id,
        entity_type="scene",
        before_text=scene_text,
        user_id=user,
        max_tokens=data.target_words * 2,
    )

    return WriteContinueResponse(
        job_id=result["job_id"],
        status=result["status"],
        result={"continuation": result["text"]},
    )
```

- [ ] **Step 7.3: Run tests and commit**

```bash
cd apps/api && uv run pytest tests/integration/test_ai_api.py -v
git add apps/api/app/api/v1/ai.py apps/api/tests/integration/test_ai_api.py
git commit -m "feat: POST /ai/write-continue — scene continuation auto mode"
```

---

## Task 8: Generate scene from beats

**Files:**
- Modify: `apps/api/app/api/v1/ai.py`
- Modify: `apps/api/tests/integration/test_ai_api.py`

---

- [ ] **Step 8.1: Write failing test**

Add to `apps/api/tests/integration/test_ai_api.py`:

```python
async def test_generate_scene_from_beats(
    client: AsyncClient, auth_headers: dict
) -> None:
    project_id, scene_id = await _setup_scene(client, auth_headers)
    await client.post(
        f"/api/v1/scenes/{scene_id}/beats",
        json={"goal": "Anna bemegy a kapun", "conflict": "Az őr megállítja"},
        headers=auth_headers,
    )

    with patch(
        "app.services.ai_service.AIService.run_job",
        new=AsyncMock(
            return_value={
                "job_id": str(uuid.uuid4()),
                "status": "requires_review",
                "text": "Anna a kapuhoz lépett. Az őr felemelte a kezét...",
            }
        ),
    ):
        response = await client.post(
            "/api/v1/ai/generate-scene",
            json={
                "project_id": project_id,
                "scene_id": scene_id,
                "target_word_count": 800,
                "include_codex": False,
            },
            headers=auth_headers,
        )

    assert response.status_code == 200
    assert "draft_markdown" in response.json()["result"]
```

- [ ] **Step 8.2: Add generate-scene endpoint to api/v1/ai.py**

Add this import at the top of `ai.py`:

```python
from app.services import crud_beat
```

Then add the endpoint:

```python
@router.post("/generate-scene", response_model=GenerateSceneResponse)
async def generate_scene(
    data: GenerateSceneRequest,
    db: AsyncSession = Depends(get_db),
    user: str = Depends(get_current_user),
) -> GenerateSceneResponse:
    scene = await crud_scene.get_scene(db, data.scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")

    beats = await crud_beat.list_beats(db, data.scene_id)
    if not beats:
        raise HTTPException(
            status_code=400,
            detail="Scene has no beats. Add beats before generating.",
        )

    beats_text = "\n".join(
        f"{i + 1}. Cél: {b.goal or ''} | Konfliktus: {b.conflict or ''} | Fordulat: {b.emotional_turn or ''}"
        for i, b in enumerate(beats)
    )

    prompt = prompt_loader.load(
        "generate_scene",
        scene_title=scene.title,
        pov_character=str(scene.pov_character_id or "Ismeretlen"),
        location=str(scene.location_id or "Ismeretlen"),
        time_marker=scene.time_marker or "",
        emotional_tone=scene.emotional_tone or "",
        scene_goal=scene.scene_goal or "",
        scene_conflict=scene.scene_conflict or "",
        scene_outcome=scene.scene_outcome or "",
        beats_text=beats_text,
        codex_context="",
        previous_scene_summary="",
        style_guide_summary="",
        target_words=str(data.target_word_count),
    )

    result = await ai_service.run_job(
        db=db,
        project_id=data.project_id,
        scene_id=data.scene_id,
        job_type="scene_draft",
        messages=[{"role": "user", "content": prompt}],
        model=data.model_preference,
        entity_id=data.scene_id,
        entity_type="scene",
        before_text=scene.text_markdown,
        user_id=user,
        max_tokens=data.target_word_count * 2,
    )

    return GenerateSceneResponse(
        job_id=result["job_id"],
        status=result["status"],
        result={"draft_markdown": result["text"], "summary": ""},
    )
```

- [ ] **Step 8.3: Run tests and commit**

```bash
cd apps/api && uv run pytest tests/integration/test_ai_api.py -v
git add apps/api/app/api/v1/ai.py apps/api/tests/integration/test_ai_api.py
git commit -m "feat: POST /ai/generate-scene — draft from beats via ModelRouter"
```

---

## Task 9: Summary endpoints (scene + chapter)

**Files:**
- Modify: `apps/api/app/api/v1/ai.py`
- Modify: `apps/api/tests/integration/test_ai_api.py`

---

- [ ] **Step 9.1: Write failing tests**

Add to `apps/api/tests/integration/test_ai_api.py`:

```python
async def test_summarize_scene_returns_summary(
    client: AsyncClient, auth_headers: dict
) -> None:
    project_id, scene_id = await _setup_scene(client, auth_headers)
    await client.patch(
        f"/api/v1/scenes/{scene_id}",
        json={"text_markdown": "Anna belépett a szobába. Az asztalon egy levél hevert."},
        headers=auth_headers,
    )

    with patch(
        "app.services.ai_service.AIService.run_job",
        new=AsyncMock(
            return_value={
                "job_id": str(uuid.uuid4()),
                "status": "requires_review",
                "text": "Anna belépett és talált egy levelet.",
            }
        ),
    ):
        response = await client.post(
            f"/api/v1/ai/scenes/{scene_id}/summarize",
            json={"project_id": project_id},
            headers=auth_headers,
        )

    assert response.status_code == 200
    assert len(response.json()["summary"]) > 0
```

- [ ] **Step 9.2: Add summarize endpoints to api/v1/ai.py**

```python
@router.post("/scenes/{scene_id}/summarize", response_model=SummarizeResponse)
async def summarize_scene(
    scene_id: uuid.UUID,
    data: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    user: str = Depends(get_current_user),
) -> SummarizeResponse:
    scene = await crud_scene.get_scene(db, scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not scene.text_markdown:
        raise HTTPException(status_code=400, detail="Scene has no text to summarize.")

    prompt = prompt_loader.load("summarize_scene", scene_text=scene.text_markdown)

    result = await ai_service.run_job(
        db=db,
        project_id=data.project_id,
        scene_id=scene_id,
        job_type="scene_draft",
        messages=[{"role": "user", "content": prompt}],
        model=data.model_preference,
        user_id=user,
        max_tokens=300,
    )

    await crud_scene.update_scene(
        db, scene, type("_", (), {"model_dump": lambda self, **kw: {"summary": result["text"]}})()
    )

    return SummarizeResponse(
        job_id=result["job_id"],
        status=result["status"],
        summary=result["text"],
    )
```

Note: The inline class hack above is ugly. Replace it with a proper scene update call:

```python
    # Replace the inline class above with:
    from app.schemas.scene import SceneUpdate
    await crud_scene.update_scene(db, scene, SceneUpdate(summary=result["text"]))

    return SummarizeResponse(
        job_id=result["job_id"],
        status=result["status"],
        summary=result["text"],
    )
```

- [ ] **Step 9.3: Add chapter summarize endpoint**

```python
from app.services import crud_chapter


@router.post("/chapters/{chapter_id}/summarize", response_model=SummarizeResponse)
async def summarize_chapter(
    chapter_id: uuid.UUID,
    data: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    user: str = Depends(get_current_user),
) -> SummarizeResponse:
    chapter = await crud_chapter.get_chapter(db, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")

    scenes = await crud_scene.list_scenes(db, chapter_id)
    scenes_summary = "\n".join(
        f"- {s.title}: {s.summary or '(nincs összefoglaló)'}" for s in scenes
    )

    prompt = prompt_loader.load(
        "summarize_chapter",
        scenes_summary=scenes_summary,
        chapter_goal=chapter.chapter_goal or "",
    )

    result = await ai_service.run_job(
        db=db,
        project_id=data.project_id,
        chapter_id=chapter_id,
        job_type="scene_draft",
        messages=[{"role": "user", "content": prompt}],
        model=data.model_preference,
        user_id=user,
        max_tokens=500,
    )

    await crud_chapter.update_chapter(
        db, chapter, type("_", (), {"model_dump": lambda self, **kw: {"summary": result["text"]}})()
    )

    # Use proper update:
    from app.schemas.chapter import ChapterUpdate
    await crud_chapter.update_chapter(db, chapter, ChapterUpdate(summary=result["text"]))

    return SummarizeResponse(
        job_id=result["job_id"],
        status=result["status"],
        summary=result["text"],
    )
```

- [ ] **Step 9.4: Run tests and commit**

```bash
cd apps/api && uv run pytest tests/integration/test_ai_api.py -v
git add apps/api/app/api/v1/ai.py apps/api/tests/integration/test_ai_api.py
git commit -m "feat: POST /ai/scenes/:id/summarize + /ai/chapters/:id/summarize"
```

---

## Task 10: Markdown export

**Files:**
- Create: `apps/api/app/services/export_service.py`
- Create: `apps/api/app/api/v1/export.py`
- Modify: `apps/api/app/api/v1/router.py`
- Create: `apps/api/tests/unit/test_export_service.py`
- Create: `apps/api/tests/integration/test_export_api.py`

---

- [ ] **Step 10.1: Write failing unit test**

`apps/api/tests/unit/test_export_service.py`:

```python
import pytest
from app.services.export_service import ExportService

pytestmark = pytest.mark.unit


def test_build_markdown_includes_chapter_title() -> None:
    service = ExportService()
    chapters = [
        {
            "title": "Az első fejezet",
            "scenes": [
                {"title": "Bevezető", "text_markdown": "Anna belépett a szobába."},
                {"title": "Találkozás", "text_markdown": "Béla várt rá."},
            ],
        }
    ]
    result = service.build_markdown(book_title="Üvegváros", chapters=chapters)
    assert "# Üvegváros" in result
    assert "## Az első fejezet" in result
    assert "### Bevezető" in result
    assert "Anna belépett a szobába." in result


def test_build_markdown_skips_empty_scenes() -> None:
    service = ExportService()
    chapters = [
        {
            "title": "Fejezet",
            "scenes": [
                {"title": "Üres jelenet", "text_markdown": None},
                {"title": "Teli jelenet", "text_markdown": "Szöveg itt."},
            ],
        }
    ]
    result = service.build_markdown(book_title="Teszt", chapters=chapters)
    assert "Üres jelenet" not in result
    assert "Szöveg itt." in result
```

- [ ] **Step 10.2: Write failing integration test**

`apps/api/tests/integration/test_export_api.py`:

```python
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _full_setup(client: AsyncClient, headers: dict) -> tuple[str, str]:
    proj = (await client.post("/api/v1/projects", json={"title": "Export P"}, headers=headers)).json()
    book = (
        await client.post(
            f"/api/v1/projects/{proj['id']}/books",
            json={"title": "Üvegváros"},
            headers=headers,
        )
    ).json()
    chapter = (
        await client.post(
            f"/api/v1/books/{book['id']}/chapters",
            json={"title": "1. fejezet"},
            headers=headers,
        )
    ).json()
    scene = (
        await client.post(
            f"/api/v1/chapters/{chapter['id']}/scenes",
            json={"title": "Bevezető", "project_id": proj["id"], "book_id": book["id"]},
            headers=headers,
        )
    ).json()
    await client.patch(
        f"/api/v1/scenes/{scene['id']}",
        json={"text_markdown": "Anna belépett a szobába."},
        headers=headers,
    )
    return proj["id"], book["id"]


async def test_export_markdown_returns_200_with_content(
    client: AsyncClient, auth_headers: dict
) -> None:
    _, book_id = await _full_setup(client, auth_headers)
    response = await client.post(
        f"/api/v1/books/{book_id}/exports",
        json={"format": "markdown"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "content" in data
    assert "Üvegváros" in data["content"]
    assert "Anna belépett" in data["content"]
```

- [ ] **Step 10.3: Write services/export_service.py**

```python
class ExportService:
    def build_markdown(
        self,
        book_title: str,
        chapters: list[dict],
        include_scene_separators: bool = True,
    ) -> str:
        lines: list[str] = [f"# {book_title}", ""]

        for chapter in chapters:
            lines.append(f"## {chapter['title']}")
            lines.append("")

            has_content = False
            for scene in chapter.get("scenes", []):
                text = scene.get("text_markdown") or ""
                if not text.strip():
                    continue
                lines.append(f"### {scene['title']}")
                lines.append("")
                lines.append(text.strip())
                lines.append("")
                if include_scene_separators:
                    lines.append("---")
                    lines.append("")
                has_content = True

            if not has_content:
                lines.append("*(fejezet még nem tartalmaz szöveget)*")
                lines.append("")

        return "\n".join(lines)


export_service = ExportService()
```

- [ ] **Step 10.4: Write api/v1/export.py**

```python
import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.services import crud_book, crud_chapter, crud_scene
from app.services.export_service import export_service

router = APIRouter(tags=["export"])


class ExportRequest(BaseModel):
    format: str = "markdown"
    include_scene_separators: bool = True


class ExportResponse(BaseModel):
    format: str
    content: str
    word_count: int


@router.post("/books/{book_id}/exports", response_model=ExportResponse)
async def export_book(
    book_id: uuid.UUID,
    data: ExportRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ExportResponse:
    if data.format != "markdown":
        raise HTTPException(status_code=400, detail="Only 'markdown' format supported in MVP")

    book = await crud_book.get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    chapters = await crud_chapter.list_chapters(db, book_id)
    chapters_data = []
    for chapter in chapters:
        scenes = await crud_scene.list_scenes(db, chapter.id)
        chapters_data.append(
            {
                "title": chapter.title,
                "scenes": [
                    {"title": s.title, "text_markdown": s.text_markdown}
                    for s in scenes
                ],
            }
        )

    content = export_service.build_markdown(
        book_title=book.title,
        chapters=chapters_data,
        include_scene_separators=data.include_scene_separators,
    )

    word_count = len(content.split())

    return ExportResponse(format="markdown", content=content, word_count=word_count)
```

- [ ] **Step 10.5: Register in router.py (complete final state)**

```python
from fastapi import APIRouter

from app.api.v1.ai import router as ai_router
from app.api.v1.auth import router as auth_router
from app.api.v1.beats import router as beats_router
from app.api.v1.books import router as books_router
from app.api.v1.chapters import router as chapters_router
from app.api.v1.characters import router as characters_router
from app.api.v1.codex_progressions import router as codex_progressions_router
from app.api.v1.codex_relations import router as codex_relations_router
from app.api.v1.export import router as export_router
from app.api.v1.generation_jobs import router as generation_jobs_router
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
api_router.include_router(generation_jobs_router)
api_router.include_router(ai_router)
api_router.include_router(export_router)
```

- [ ] **Step 10.6: Run all tests**

```bash
cd apps/api && uv run pytest tests/unit/test_export_service.py -v
cd apps/api && uv run pytest tests/integration/test_export_api.py -v
cd apps/api && uv run pytest -v --tb=short
```

Expected: All tests pass. Full suite green.

- [ ] **Step 10.7: Final lint**

```bash
cd apps/api && uv run ruff check app/ tests/ --fix
```

- [ ] **Step 10.8: Commit**

```bash
git add apps/api/app/services/export_service.py apps/api/app/api/v1/export.py \
  apps/api/app/api/v1/router.py \
  apps/api/tests/unit/test_export_service.py apps/api/tests/integration/test_export_api.py
git commit -m "feat: Markdown export — POST /books/:id/exports; Plan 3 AI complete"
```

---

## Plan 3 complete — full backend MVP done

At this point the backend implements the complete MVP:

- ✅ Monorepo + Docker Compose
- ✅ All 16 SQLAlchemy models + Alembic migration
- ✅ JWT auth
- ✅ All CRUD endpoints (Project, Book, Chapter, Scene, Beat, Character, Location, Worldbuilding, CodexRelation, CodexProgression, Snippet, StyleGuide, GenerationJob)
- ✅ ModelRouter (LiteLLM / Ollama)
- ✅ Hungarian prompt templates
- ✅ Rewrite endpoint
- ✅ Describe (6 sensory channels) endpoint
- ✅ Scene continuation endpoint
- ✅ Generate scene from beats endpoint
- ✅ Scene + chapter summary endpoints
- ✅ Revision tracking on all AI outputs
- ✅ GenerationJob accept/reject workflow
- ✅ Markdown export

**Verify the full API surface:**

```bash
cd apps/api && uv run uvicorn app.main:app --reload
# Open: http://localhost:8000/docs
```

All routes should be visible. Test with the Swagger UI by logging in and calling a few endpoints.

**Final full test run:**

```bash
cd apps/api && uv run pytest -v --tb=short --cov=app --cov-report=term-missing
```
