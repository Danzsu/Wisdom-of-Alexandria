# Chapter Automation (V2 first slice) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Fresh implementer per task + two-stage review (spec then quality). The controller commits (implementers must NOT commit). Steps use `- [ ]`.

**Goal:** Generate a whole chapter scene-by-scene from each scene's beats, as one background job, producing one unapproved Revision per scene for human review — shipping the deferred MVP #11 with no new AI infrastructure.

**Architecture:** Orchestrate the existing scene-generation core over a user-selected set of the chapter's scenes, run as an RQ background job (the proven `index_job` pattern). Each scene → `Revision(approved=false)` linked to the parent chapter job (HITL preserved — nothing auto-overwrites). Writer-only by default; an optional per-run continuity pass. The user picks exactly which scenes to generate via per-scene checkboxes (empty+beats pre-checked; non-empty+beats opt-in; no-beats disabled).

**Tech:** apps/ai (FastAPI AI, RQ worker), apps/api (domain — scene/beat reads, revision approve already exist), packages/db (GenerationJob/Revision models exist), packages/shared (OpenAPI→TS regen), apps/web (Next.js).

---

## Global constraints (implementers + reviewers)
- **HITL is non-negotiable:** every generated scene is a `Revision(approved=false)`; the manuscript is only updated when the user approves (the existing `approve_revision` flow). The chapter job NEVER sets a scene's content directly.
- **Reuse, don't reinvent:** reuse `AIService.generate_scene`'s core (refactored into a reusable unit), `revision_service.save_revision`, `_rag_context` (progression-aware), the `index_job.py` async-job pattern, `job_queue.py`, the existing `/jobs` polling, and the existing per-scene revision accept/reject UI.
- **Per-scene failure is isolated:** one scene erroring marks that scene `failed` and the loop continues; the job ends `done` with partial results. The job is only `failed` if it can't start at all.
- **Tokens/i18n/tests:** frontend copy via `@/lib/i18n/hu`; semantic Tailwind tokens; FTDD (vitest+axe / pytest); mutation-proof assertions (assert the real effect — revisions created, progress advanced, the right scenes selected — not just status codes). Keep all suites green (web 814 / api 536 / ai 398 baseline).
- **No secret/PII leak; sanitized errors** (reuse `safe_error`). Bounded inputs.

---

## Task 1 — Refactor the scene-generation core into a reusable unit (apps/ai)

**Files:** `apps/ai/app/services/ai_service.py` (+ its tests).

Today `AIService.generate_scene(...)` does: create a per-call `GenerationJob` → RAG → model → `save_revision` → complete job → return `AIResult`. The chapter job needs to generate a scene **without** creating a separate per-scene job (the revision must link to the PARENT chapter job).

- [ ] Extract a method `generate_scene_revision(db, *, scene, beats, characters="", location="", style_notes="", job_id, model=None, temperature=None, max_tokens=None) -> Revision` that does RAG (progression-aware, passing `scene.id`) + model call + `save_revision(approved=False, scene_id=scene.id, job_id=job_id, revision_type="generate_scene", ...)` and returns the Revision. NO job creation/completion inside it.
- [ ] Re-implement the existing `generate_scene` endpoint path in terms of it: create the per-call job, call `generate_scene_revision(..., job_id=job.id)`, complete the job, return `AIResult` — so the single-scene endpoint behaves identically (regression-safe).
- [ ] Tests: the existing generate_scene tests stay green; add a unit test that `generate_scene_revision` creates an `approved=False` revision linked to the passed `job_id` + `scene_id`, and (mocking the router) that the rendered prompt includes the beats (mirror the hardened rag-integration assertion). Mutation-check: dropping the `job_id` link fails the test.

---

## Task 2 — Chapter-generate endpoint + job creation/enqueue (apps/ai + packages/db)

**Files:** `apps/ai/app/api/v1/ai.py` (new route), `apps/ai/app/schemas/` (request schema), `apps/ai/app/services/job_queue.py` (enqueue fn), `packages/db/alexandria_core/models/generation_job.py` (add `JobType.CHAPTER_GENERATE = "chapter_generate"`), tests.

- [ ] `ChapterGenerateRequest(BaseModel)`: `scene_ids: list[uuid.UUID]` (min 1, max ~200), `run_continuity: bool = False`, optional `model/temperature/max_tokens` (same bounds as generate_scene).
- [ ] `POST /ai/chapters/{chapter_id}/generate` (auth-protected). Validates: chapter exists; every `scene_id` belongs to that chapter; each selected scene HAS at least one beat (reject the request 422 if any selected scene has no beats — the UI disables those, so this is a guard). Empty `scene_ids` → 422. Creates a parent `GenerationJob(job_type="chapter_generate", chapter_id=chapter_id, project_id=<resolved>, status=PENDING, input_data={scene_ids:[...], run_continuity})`, enqueues `enqueue_chapter_generation_job(job.id)`, returns **202** + `GenerationJobRead`.
- [ ] `enqueue_chapter_generation_job(job_id)` in `job_queue.py` → enqueues `"app.jobs.chapter_generation_job.run_chapter_generation_job"` on the `"ai"` queue (mirror `enqueue_index_job`).
- [ ] Tests: 422 on empty selection / a scene not in the chapter / a selected scene with no beats; 202 + a PENDING job with the right `input_data` on a valid request; auth required; enqueue called once with the job id (spy). Mutation-check: removing the "scene belongs to chapter" guard fails a cross-chapter test.

---

## Task 3 — The background job: `run_chapter_generation_job` (apps/ai)

**Files:** `apps/ai/app/jobs/chapter_generation_job.py` (new), tests.

Follow `index_job.py` exactly for structure (sync entry → `asyncio.run` → async impl with own session, status machine, `safe_error`).

- [ ] `run_chapter_generation_job(job_id: str)` → `asyncio.run(_run(uuid))`.
- [ ] `_run(job_id)`: load the parent job; set `RUNNING`; read `input_data`. Resolve the selected scenes (in `order_index` order), each with its beats. Initialize `output_data = {total: N, completed: 0, failed: 0, skipped: [...], scenes: []}` and commit.
- [ ] For each selected scene **sequentially**: load its beats (descriptions, ordered); call `AIService.generate_scene_revision(..., job_id=job_id)` → on success append `{scene_id, revision_id, status:"done", warning_count:0}`, `completed += 1`. If `run_continuity`: run `AIService.check_continuity(scene_id=...)` on the new text, set `warning_count`, and stash warnings (in the revision's job linkage / output). On a per-scene exception: `failed += 1`, append `{scene_id, status:"failed", error: safe_error(exc)}`, **continue** (rollback that scene's partial tx, keep going). Commit `output_data` after each scene so the UI polls live progress.
- [ ] Finish: `status = DONE` (even with partial failures); only `FAILED` if it couldn't start (job/chapter missing). Sanitized `error_message` on hard failure.
- [ ] Tests (mock `generate_scene_revision`/router so no real LLM): N selected scenes → N `approved=False` revisions linked to the parent job; `output_data` progress advances (completed/failed counts; scenes array entries); a scene that raises is isolated (failed++ and the rest still complete); `run_continuity=True` populates `warning_count`; empty/edge handled. Mutation-check: making a per-scene failure abort the loop fails the isolation test.

---

## Task 4 — Shared types + the "Fejezet generálása" selection modal (packages/shared + apps/web)

**Files:** regen `packages/shared` (the new endpoint + `ChapterGenerateRequest`/job shape); `apps/web/lib/api/*` (client fn + `useGenerateChapter` mutation hook + a `useChapterScenesForGeneration` data source); a new `apps/web/components/plan/generate-chapter-dialog.tsx` (or co-located with the plan board); wire a "Fejezet generálása" trigger on the chapter (plan board); `apps/web/lib/i18n/hu.ts`; tests.

- [ ] Regen shared types (gen script); if `ai.json` is the only meaningful change that's expected (AI-service endpoint); revert any whitespace-only `api.json` churn.
- [ ] Data for the selection list: fetch the chapter's scenes + each scene's beat-count + empty-state. Use existing endpoints (scene list + beats); if a beat-count isn't readily available per scene, fetch beats per scene or add a lightweight `beat_count` to the scene read used here — prefer reusing existing data; keep it minimal.
- [ ] `GenerateChapterDialog`: a kit `Modal` listing the chapter's scenes, each a row with a `CheckboxRow`:
  - empty (no content) AND `beat_count>0` → **checked by default**;
  - non-empty AND `beat_count>0` → rendered, **unchecked by default**, with a subtle "már van szövege — újragenerálás revízióként" hint;
  - `beat_count==0` → **disabled** checkbox + "nincs beat" hint (cannot be selected).
  Plus a "folytonosság-ellenőrzéssel" `ToggleSwitch`/checkbox (default off) and a "Generálás" button (loading state). Submit → `useGenerateChapter` POST with the checked `scene_ids` + `run_continuity` → toast ("Fejezet generálása elindítva — N jelenet") → close; the job appears in AI feladatok. Disable the Generálás button when nothing is checked.
- [ ] All copy via a new `hu.chapterGen` namespace. a11y: the modal traps focus, every checkbox labeled, Esc closes.
- [ ] Tests (vitest + MSW): defaults correct (empty+beats pre-checked; non-empty unchecked; no-beats disabled+unselectable); checking a non-empty scene includes it; POST fires with exactly the checked `scene_ids` + the continuity flag (capture via MSW); Generálás disabled when none checked; `expectNoA11yViolations(document)` with the modal open. Mutation-check: a bug that pre-checks non-empty scenes fails the defaults test.

---

## Task 5 — Job progress + per-scene review (apps/web)

**Files:** `apps/web/components/jobs/jobs-screen.tsx` (+ the jobs list item), the job detail/progress rendering, a review affordance; tests.

- [ ] Render `chapter_generate` jobs in the AI feladatok screen with live progress from `output_data` (e.g. "3/5 kész · 1 sikertelen · 2 kihagyva"), polling the existing `/jobs/{id}` until done/failed (reuse the index-job polling pattern).
- [ ] Review affordance: from a done chapter job, list its scenes with their generated revision + a link/inline way to accept/reject each (reuse the existing revision approve/reject — opening the scene's inspector AI tab is acceptable for the first slice; a richer batch-review panel is a fast-follow, note it). Make it obvious which scenes still have a pending (unapproved) revision.
- [ ] Tests: a `chapter_generate` job renders its progress counts (per-row, exact numbers — not "exists"); the review affordance surfaces the pending revisions and an approve action calls the approve endpoint (MSW capture). a11y clean.

---

## Task 6 — Integration + sanity (controller)
- [ ] End-to-end test (where feasible, mocked model): select 2 empty + 1 non-empty scene → POST → job runs → 3 `approved=false` revisions linked to the job → approve one → that scene's content + word_count updated, others untouched.
- [ ] Full suites green: `apps/ai` + `apps/api` pytest, `apps/web` vitest + tsc + lint; shared types fresh (ai.json regen only). Migration: none expected (no schema change) — confirm.
- [ ] Live (chrome-devtools, dev server): the GenerateChapterDialog renders with correct defaults; the jobs screen shows a chapter job's progress; a11y/contrast clean on the new UI (light+dark). Responsive spot-check.
- [ ] Update docs/17 (chapter automation shipped) + docs/02.

## Out of scope (note, not done)
- Book-level (all chapters) automation — chapter-level first; book is a later extension.
- Per-scene model override; full writer+reviewer agent loop (continuity is the opt-in seed of it).
- A dedicated rich batch-review screen (reuse per-scene approve first).

## Verification
Per task: its tests + the targeted suite green; spec then quality review; mutation-checks where noted. End: all suites green, live a11y/contrast clean on the new UI, HITL invariant proven (nothing auto-overwrites).
