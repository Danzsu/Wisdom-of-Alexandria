# Codex Image Generation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Each task is TDD: failing test → run-it-fails → implement → run-it-passes → commit. Ask permission before each commit (project commit policy). Backend tests run on SQLite locally; the real-image-API path is mocked in tests (never call the live provider in CI).

**Goal:** Generate consistent **character** and **location** images from Codex entries using Google "Nano Banana 2" (Gemini 2.5/3.x Flash Image) via reusable, placeholder-filled style presets, persisted as approvable `MediaAsset`s with a per-entry **canonical reference image** for consistency. (Phase 2 = book-cover generator; out of scope here.)

**Architecture:** A new `MediaAsset` model stores image metadata in Postgres; the **binary lives on the local filesystem** (`settings.media_dir`), object-store deferred to V2. Image generation goes through a new `ModelRouter.generate_image()` that calls the **direct `google-genai` SDK** (LiteLLM's image route lags the June-2026 Gemini 3.x models), resolving creds from the existing Fernet-encrypted `Provider` config (new `Provider.image_model` field). Generation runs as an **RQ async job** (reusing the P1L-1 `GenerationJob` + `app/jobs/` pattern): the endpoint creates a `pending` job + `MediaAsset(status=generating)`, enqueues it, the worker fills placeholders from Codex fields + an optional canonical reference image, calls the provider, writes the file + flips the asset to `ready`. The user approves an asset as the entry's **canonical** reference (HITL — mirrors the Revision pattern). Style presets are **versioned prompt templates** with `{placeholder}` tokens (e.g. `{appearance}`, `{atmosphere}`), loaded like `packages/prompts`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async (apps/ai) · `google-genai` SDK · `Pillow` (thumbnails) · RQ/Redis (async jobs) · Alembic (migration) · Next.js 15 + TanStack Query + Zod (frontend) · pytest / vitest+MSW (tests).

---

## File Structure

**Backend (`packages/db` / `apps/ai` / `apps/api`):**
- `packages/db/alexandria_core/models/media_asset.py` — **new** `MediaAsset` model (image metadata + status + scope + entity link + canonical flag).
- `packages/db/alexandria_core/core/config.py` — **modify**: add `media_dir: str` (default `./media` / `/data/media` in Docker) + `MAX_IMAGE_BYTES`.
- `packages/db/alexandria_core/models/provider.py` — **modify**: add `image_model: str | None`.
- `apps/api/alembic/versions/f6…_add_media_assets_and_provider_image_model.py` — **new** migration (table + `providers.image_model` column; dialect-split FK like prior migrations; register stripped cols in `91516a452442` `_COLUMNS_ADDED_LATER` + `_TABLES_ADDED_LATER`).
- `apps/ai/app/services/model_router.py` — **modify**: add `generate_image(prompt, *, model, db, reference_images=None, aspect_ratio="2:3")` using `google-genai`.
- `apps/ai/app/services/image_service.py` — **new**: `ImageService` — placeholder-fill from Codex, call router, save file+thumbnail, create/flip `MediaAsset`, set-canonical, list/delete. Reuses `revision_service.create_job` / `complete_job` / `fail_job`.
- `apps/ai/app/services/image_prompt.py` — **new**: load a style preset + interpolate `{placeholders}` from a Character/Location row.
- `packages/prompts/hu/image_styles/*.md` — **new**: detailed canned style presets (`realistic_portrait`, `painterly_fantasy`, `anime`, `noir`, `watercolor_location`, …) with `{placeholder}` tokens.
- `apps/ai/app/schemas/media_asset.py` — **new**: `MediaAssetRead`, `ImageGenerateRequest`, `ImageStyleInfo`.
- `apps/ai/app/schemas/provider.py` + `crud_provider.py` + `provider_service.py` — **modify**: `image_model` in Create/Update/Read + masked exposure + model discovery.
- `apps/ai/app/jobs/image_job.py` — **new**: RQ worker job `run_image_job(job_id)` (sync → `asyncio.run`), own session, pending→running→done/failed, calls `ImageService`.
- `apps/ai/app/services/job_queue.py` — **modify**: `enqueue_image_job(job_id)` + `INDEX_JOB_PATH` sibling `IMAGE_JOB_PATH`.
- `apps/ai/app/api/v1/images.py` — **new** router: `POST /ai/images` (enqueue), `GET /ai/images?entity_type=&entity_id=` (list), `POST /ai/images/{id}/canonical` (approve as reference), `DELETE /ai/images/{id}`, `GET /ai/images/styles` (preset catalog), `GET /ai/media/{id}` (serve the binary/thumbnail). Registered in `apps/ai/app/api/v1/router.py`.

**Frontend (`apps/web`):**
- `apps/web/lib/api/images.ts` — client: `listImages`, `generateImage`, `setCanonical`, `deleteImage`, `listImageStyles`, `mediaUrl(id)`.
- `apps/web/lib/api/image-types.ts` — Zod schemas + `MatchesContract` ties to generated shared types.
- `apps/web/lib/api/image-hooks.ts` — `useEntityImages`, `useGenerateImage` (enqueue + poll job), `useSetCanonical`, `useDeleteImage`, `useImageStyles`.
- `apps/web/components/codex/image-panel.tsx` — the "Képek" panel in the Codex detail (style picker, generate button, gallery, set-canonical, regenerate, delete).
- `apps/web/lib/i18n/hu.ts` — **modify**: `images` block.
- `apps/web/test/msw/{handlers,fixtures}.ts` — **modify**: `/ai/images*` + `/ai/media/*` handlers + fixtures.
- Tests alongside each (`__tests__`).

---

## Task 1: `MediaAsset` model + config

**Files:** Create `packages/db/alexandria_core/models/media_asset.py`; Modify `packages/db/alexandria_core/core/config.py`, `packages/db/alexandria_core/models/__init__.py`.

- [ ] **Step 1 — failing test** `apps/ai/tests/integration/test_media_asset_model.py`: insert a `MediaAsset(project_id, entity_type="character", entity_id, status="ready", file_path, model_name, style, prompt, width, height, is_canonical=False)` and read it back; assert defaults (`status` default `"generating"`, `is_canonical` default `False`) and the `(entity_type, entity_id)` index exists.
- [ ] **Step 2** run → fails (model missing).
- [ ] **Step 3 — implement.** `MediaAsset(UUIDPrimaryKey, Timestamps, Base)` columns: `project_id` (FK projects CASCADE, indexed), `entity_type: str(32)` (`character|location|cover`), `entity_id: uuid|None` (indexed; null for project-level covers), `status: str(20)` default `"generating"` (`generating|ready|failed`), `file_path: str(512)|None`, `thumb_path: str(512)|None`, `mime: str(50)` default `"image/png"`, `width: int|None`, `height: int|None`, `model_name: str(255)|None`, `style: str(100)|None`, `prompt: Text|None`, `error_message: Text|None`, `is_canonical: bool` default False, `job_id: uuid|None`. Add `Index("ix_media_assets_entity", "entity_type", "entity_id")`. Register import in `models/__init__.py`. Add to `config.py`: `media_dir: str = "./media"` and `max_image_bytes: int = 15_000_000`.
- [ ] **Step 4** run → passes (SQLite create_all builds it).
- [ ] **Step 5 — commit** `feat(media): MediaAsset model + media_dir config`.

## Task 2: `Provider.image_model` + schema + migration

**Files:** Modify `models/provider.py`, `apps/ai/app/schemas/provider.py`, `apps/ai/app/services/crud_provider.py`, `provider_service.py`; Modify `91516a452442_initial_schema.py` (`_TABLES_ADDED_LATER` += `media_assets`, `_COLUMNS_ADDED_LATER["providers"] += {"image_model"}`); Create the Alembic migration.

- [ ] **Step 1 — failing test** `test_provider_image_model.py`: `ProviderCreate(..., image_model="gemini/gemini-3.1-flash-image")` round-trips through create→read (masked read still shows `image_model`); a provider with `image_model` set is discoverable.
- [ ] **Step 2** run → fails.
- [ ] **Step 3 — implement.** Add `image_model: Mapped[str|None] = mapped_column(String(255), nullable=True)` to `Provider` (mirror `embedding_model`). Add `image_model` to `ProviderCreate/Update/Read` (+ to the create/update CRUD + the masked Read mapping). Write migration `f6a1b2c3d4e5_add_media_assets_and_provider_image_model.py` chained off head `c680092`'s alembic head (run `uv run --directory apps/api alembic heads` to get it): `op.add_column("providers", image_model)` + `op.create_table("media_assets", …)` with the dialect-split FK pattern (named CASCADE FK on PG only; bare column + index on SQLite) exactly like `e5a1b2c3d4f6`. Teach `91516a452442` to strip both.
- [ ] **Step 4** run → passes; also run `alembic upgrade head` + `downgrade -1` on a throwaway sqlite to verify.
- [ ] **Step 5 — commit** `feat(media): Provider.image_model + media_assets migration`.

## Task 3: `google-genai` dep + `ModelRouter.generate_image()`

**Files:** Modify `apps/ai/pyproject.toml` (+`packages/db/pyproject.toml` if the SDK is needed there — it is not; keep it in apps/ai), `apps/ai/app/services/model_router.py`. Run `uv sync` (offline lock).

- [ ] **Step 1 — failing test** `apps/ai/tests/unit/test_model_router_image.py`: patch `google.genai.Client`; call `await model_router.generate_image("a knight", model="gemini/gemini-3.1-flash-image", db=db, aspect_ratio="2:3")`; assert it (a) resolved the provider key via `resolve_provider`, (b) passed the prompt + aspect ratio config, (c) returned `ImageResult(data: bytes, mime: str, model: str)`; and a SHORT byte response still returns bytes. Mutation: a provider with an undecryptable key must raise (reuse the `complete()` loud-failure contract).
- [ ] **Step 2** run → fails.
- [ ] **Step 3 — implement.** Add `"google-genai>=1.0"` + `"pillow>=10"` to `apps/ai/pyproject.toml`. Add `@dataclass ImageResult(data: bytes, mime: str, model: str)`. Add:
```python
async def generate_image(self, prompt, *, model, db, reference_images=None, aspect_ratio="2:3", **kw) -> ImageResult:
    resolved = await self.resolve_provider(db, model)          # reuse Fernet key + base_url
    model_id = model.split("/", 1)[-1] if "/" in model else model
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=resolved.api_key)
    parts = [prompt, *(reference_images or [])]                 # multi-image conditioning (bytes/PIL)
    resp = await asyncio.to_thread(
        client.models.generate_content,
        model=model_id, contents=parts,
        config=types.GenerateContentConfig(
            response_modalities=["Image"],
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
        ),
    )
    img = _first_inline_image(resp)        # raise loudly if no image part
    return ImageResult(data=img.data, mime=img.mime_type or "image/png", model=model_id)
```
  Resolution control: only `aspect_ratio` (research-verified — NO arbitrary resolution). Surface no key / decrypt-fail loudly like `complete()`/`embed()`.
- [ ] **Step 4** run → passes.
- [ ] **Step 5 — commit** `feat(media): ModelRouter.generate_image via google-genai (Provider-resolved, aspect-ratio control)`.

## Task 4: Style presets + `image_prompt` placeholder fill

**Files:** Create `packages/prompts/hu/image_styles/realistic_portrait.md`, `painterly_fantasy.md`, `anime.md`, `noir_portrait.md`, `watercolor_location.md`, `epic_landscape.md` (≥6 detailed presets); Create `apps/ai/app/services/image_prompt.py`.

- [ ] **Step 1 — failing test** `test_image_prompt.py`: `build_character_prompt(character, style="realistic_portrait")` fills `{name}/{appearance}/{role}/{personality}` from the row, leaves NO literal `{…}` token, and includes the preset's style description; an empty field becomes a neutral phrase (not a literal `None`/`{appearance}`); an unknown style raises `ValueError` listing valid styles; `build_location_prompt(location, style=...)` fills `{name}/{description}/{geography}/{atmosphere}`.
- [ ] **Step 2** run → fails.
- [ ] **Step 3 — implement.** Each `.md` preset = a system-ish style block + a `---` + a body template with placeholders, e.g. `realistic_portrait.md`:
  ```
  Photorealistic character portrait, head-and-shoulders, soft studio lighting, shallow depth of field, neutral background, highly detailed, 85mm lens.
  ---
  A portrait of {name}{role_clause}. Appearance: {appearance}. Demeanour: {personality}. {extra}
  ```
  `image_prompt.py`: a `PRESET_DIR` loader (reuse `PromptLoader`'s file/format approach), `STYLES` registry (slug → label + applicable entity types), `build_character_prompt`/`build_location_prompt` that map Codex fields → tokens with graceful empties (e.g. missing appearance → `"egy ismeretlen megjelenésű alak"`), and `available_styles(entity_type)`.
- [ ] **Step 4** run → passes.
- [ ] **Step 5 — commit** `feat(media): canned image style presets with {placeholder} tokens + Codex prompt builder`.

## Task 5: `ImageService` (generate → store → MediaAsset, HITL canonical)

**Files:** Create `apps/ai/app/services/image_service.py`, `apps/ai/app/services/image_storage.py` (file write + Pillow thumbnail).

- [ ] **Step 1 — failing tests** `test_image_service.py` (mock `ModelRouter.generate_image` → fake PNG bytes; tmp `media_dir`): `generate_for_entity(db, entity_type="character", entity_id, project_id, style, model)` (a) builds the prompt from the row, (b) feeds the current **canonical** asset's image as a reference when one exists, (c) writes file + thumbnail under `media_dir`, (d) creates a `MediaAsset(status="ready", file_path, thumb_path, width, height, model_name, style, prompt)`; `set_canonical(db, asset_id)` flips the chosen asset `is_canonical=True` and clears the flag on the entity's other assets (one canonical per entity — mutation-proof: a second set_canonical moves it); a generation failure persists `status="failed"` + sanitized `error_message` (reuse `safe_error`), never raises to crash the worker; `list_for_entity` returns newest-first; `delete` removes the row + the files.
- [ ] **Step 2** run → fails.
- [ ] **Step 3 — implement.** `image_storage.py`: `save_image(project_id, asset_id, data, mime) -> (file_path, thumb_path, w, h)` — write under `media_dir/<project_id>/<asset_id>.png`, generate a ≤512px thumbnail via Pillow, bound by `max_image_bytes`. `image_service.py`: orchestrates prompt-build (Task 4) + canonical-reference fetch + `router.generate_image` + storage + `MediaAsset` lifecycle + `set_canonical`/`list_for_entity`/`delete`. Loud-but-safe failure (sanitized, file cleanup on partial write).
- [ ] **Step 4** run → passes.
- [ ] **Step 5 — commit** `feat(media): ImageService — generate/store/thumbnail + canonical reference (HITL)`.

## Task 6: RQ async image job + enqueue

**Files:** Create `apps/ai/app/jobs/image_job.py`; Modify `apps/ai/app/services/job_queue.py`.

- [ ] **Step 1 — failing tests** `test_image_job.py` (inject the test session factory like `test_index_job.py`; mock `ImageService`): `_run_image_job(job_id, …)` transitions the `GenerationJob(job_type="image")` pending→running→done, writes the created `media_asset_id` into `output_data`; on `ImageService` error → job `failed` + sanitized message; missing job → no-op; the dotted path `IMAGE_JOB_PATH` resolves to `run_image_job`.
- [ ] **Step 2** run → fails.
- [ ] **Step 3 — implement.** `image_job.py` mirrors `index_job.py` exactly (sync `run_image_job` → `asyncio.run(_run_image_job(...))`, injectable `session_factory` + `images` service, own session, state machine, sanitized failure, no re-raise). `job_queue.py`: `IMAGE_JOB_PATH = "app.jobs.image_job.run_image_job"` + `enqueue_image_job(job_id)`.
- [ ] **Step 4** run → passes.
- [ ] **Step 5 — commit** `feat(media): RQ async image job (reuses the P1L-1 worker pattern)`.

## Task 7: `images` API router (+ media serving)

**Files:** Create `apps/ai/app/api/v1/images.py`, `apps/ai/app/schemas/media_asset.py`; Modify `apps/ai/app/api/v1/router.py`.

- [ ] **Step 1 — failing tests** `test_images_endpoints.py`: `POST /api/v1/ai/images {entity_type, entity_id, project_id, style, model?}` → validates the project exists (422 if not, BEFORE the job, like `/ai/research`), creates a `pending` job + a `generating` MediaAsset, enqueues (mock), returns 202 + the asset; missing/blank style or unknown entity_type → 422; requires auth (401). `GET /ai/images?entity_type=&entity_id=` → the entity's assets. `POST /ai/images/{id}/canonical` → flips canonical. `DELETE /ai/images/{id}` → 204. `GET /ai/images/styles` → the preset catalog. `GET /ai/media/{id}` → streams the bytes with the right content-type (404 if missing/not-ready); `?thumb=1` → the thumbnail.
- [ ] **Step 2** run → fails.
- [ ] **Step 3 — implement.** `media_asset.py` schemas: `MediaAssetRead` (id, entity_type, entity_id, status, mime, width, height, model_name, style, is_canonical, created_at — NO raw file_path leak; the UI builds the URL from id), `ImageGenerateRequest`, `ImageStyleInfo`. `images.py`: the endpoints above; `GET /ai/media/{id}` uses `FileResponse`/`StreamingResponse` from `media_dir`, guarding traversal (serve only by asset-id lookup, never a client path). Register the router.
- [ ] **Step 4** run → passes.
- [ ] **Step 5 — commit** `feat(media): /ai/images endpoints + /ai/media/{id} serving (IDOR/traversal-safe)`.

## Task 8: shared types + frontend client/hooks

**Files:** `scripts/gen-shared-types.sh` (run it); Create `apps/web/lib/api/images.ts`, `image-types.ts`, `image-hooks.ts`.

- [ ] **Step 1 — failing tests** `images.test.ts` + `image-hooks.test.tsx`: `generateImage(input)` POSTs to the AI base + parses the asset; `listImages({entityType, entityId})` parses the list; `useGenerateImage` enqueues then **polls `GET /jobs/{id}`** until done/failed (reuse the `useRebuildIndex` poll pattern) and on done invalidates `useEntityImages`; `setCanonical`/`deleteImage` hit the right routes + invalidate; `mediaUrl(id)` builds `AI_BASE/api/v1/ai/media/{id}`; `listImageStyles` parses the catalog. Zod `MatchesContract` tie compiles.
- [ ] **Step 2** run → fails.
- [ ] **Step 3 — implement.** Regenerate shared types (adds `MediaAssetRead` etc.); add to `packages/shared/src/index.ts` the named re-exports. `image-types.ts` mirrors them with Zod + drift-tie. `images.ts` client fns (AI base). `image-hooks.ts` hooks (enqueue+poll like `useRebuildIndex`, query key `["images", entityType, entityId]`).
- [ ] **Step 4** run → passes; `tsc` + freshness check clean.
- [ ] **Step 5 — commit** `feat(media): image client + hooks (enqueue+poll) + shared-type contract`.

## Task 9: Codex "Képek" panel UI

**Files:** Create `apps/web/components/codex/image-panel.tsx` (+ test); Modify the Codex detail to mount it; Modify `apps/web/lib/i18n/hu.ts` (`images` block).

- [ ] **Step 1 — failing test** `image-panel.test.tsx` (MSW): renders the style picker + Generate button; clicking Generate calls `POST /ai/images` and shows a generating placeholder; once the polled job is done the gallery shows the asset thumbnail (`<img src=mediaUrl>`); a "Beállítás kanonikusként" action calls `/canonical`; delete calls DELETE; the canonical asset is badged; empty state when no images; error state surfaces (never swallowed).
- [ ] **Step 2** run → fails.
- [ ] **Step 3 — implement.** `image-panel.tsx`: style `<select>` from `useImageStyles`, Generate (disabled while pending / until project resolved), a thumbnail gallery (`useEntityImages`), set-canonical / regenerate / delete actions, generating + error + empty states. Mount in the character/location Codex detail tab. Add the `hu.images` strings (no hardcoded Hungarian in the component).
- [ ] **Step 4** run → passes; full web suite + tsc + lint clean.
- [ ] **Step 5 — commit** `feat(media): Codex Képek panel — generate/gallery/set-canonical/delete`.

## Task 10: docs + verification gate

- [ ] Update `docs/17_status_and_roadmap.md`: move "Kép-pipeline" → Phase 1 DONE (character/location + presets); note Phase 2 (covers) pending. Note `google-genai` + `Pillow` deps + `media_dir`.
- [ ] Add `media/` (or `data/media/`) + `*.png` test artifacts to `.gitignore`.
- [ ] **Full sanity:** `ruff` (api+ai), `pytest` apps/api + apps/ai (SQLite **and** a Docker-Postgres run — the migration + MediaAsset are new), web `tsc`+`lint`+`vitest`, shared-types freshness. **Adversarial pass:** mutation-prove the canonical-flip, the failed-job sanitization (no key leak), and the `/ai/media` traversal guard.
- [ ] **Commit** `docs+chore(media): Phase-1 status + gitignore`.

---

## Test Plan (per CLAUDE.md "testing expectations")
- **Data model relations:** MediaAsset ↔ project/entity; one-canonical-per-entity invariant (Task 5).
- **API validation:** project-exists 422, unknown style/entity_type 422, auth 401, IDOR/traversal on `/ai/media` (Task 7).
- **AI workflow I/O contract:** `generate_image` provider resolution + aspect ratio + loud key-failure (Task 3); prompt placeholder fill leaves no literal token (Task 4).
- **Generation job state transitions:** pending→running→done/failed + sanitized failure (Task 6) — mutation-proven.
- **Frontend contract:** Zod↔generated `MatchesContract`; enqueue+poll hook; gallery render (Tasks 8–9).
- **Provider/secrets:** image API key Fernet-encrypted, never logged/returned; failures sanitized.

## Risks / Mitigations
- **LiteLLM vs google-genai:** chose the direct SDK (deliberate deviation, documented) because LiteLLM's image route lags Gemini 3.x (June 2026). Mitigation: `generate_image` is isolated in ModelRouter; a LiteLLM path can replace it later behind the same signature.
- **Paid-tier privacy (research):** Google free tier trains on inputs → the provider-setup UI must warn that image gen needs a **billing-enabled** key. Add the warning string in `hu.images`/provider setup.
- **Model churn:** model ids are config (`Provider.image_model`), never hardcoded — Nano Banana 2/Pro/2.5 all selectable.
- **Cost/abuse:** image jobs are RQ-queued + bounded; a per-project rate cap is a V1 follow-up (note in code).
- **Consistency is imperfect (research caveat):** the HITL canonical-approve step + reference-image conditioning is the mitigation; not LoRA.
- **Storage growth:** local FS + DB metadata for MVP; object-store (S3/MinIO) is the documented V2 path; thumbnails bound display cost.

## Self-Review
- **Spec coverage:** character images ✓ (T4–9), location images ✓ (T4–9), style presets w/ placeholders ✓ (T4), canonical consistency ✓ (T5), Google AI Studio main + configurable ✓ (T2–3), local FS + DB metadata ✓ (T1,5), async ✓ (T6), HITL approve ✓ (T5,7,9). **Covers = Phase 2 (excluded, by decision).**
- **Type consistency:** `MediaAsset` fields, `generate_image`→`ImageResult`, `ImageGenerateRequest`, query key `["images",type,id]`, dotted path `IMAGE_JOB_PATH` are used consistently across tasks.
- **Placeholders:** none — every task names exact files, signatures, and test intent (representative code shown for non-obvious parts; implementing subagents write the full TDD code per task).
