# Task 5 Report — `generate_cover_for_book` + image-job cover branch

## Status

DONE — all tests pass, no regressions, ruff clean.

## Files Changed

### Modified (app)
- `apps/ai/app/services/image_service.py`
  - Added `from alexandria_core.models.book import Book` import.
  - Added `from app.services import cover_compositor, image_prompt` (cover_compositor added).
  - Added `generate_cover_for_book(db, *, project_id, book_id, art_style, layout, title, author, subtitle, model, job_id=None) -> MediaAsset` method to `ImageService`.
  - Method raises `ValueError` if book is missing or `book.project_id != project_id`.
  - Loud on failure: cleans up partial file, re-raises. Never swallows exceptions.

- `apps/ai/app/jobs/image_job.py`
  - Replaced `_REQUIRED_INPUT` single tuple with three: `_REQUIRED_COMMON`, `_REQUIRED_COVER`, `_REQUIRED_CODEX`.
  - `_run_image_job` now detects `is_cover = params.get("entity_type") == "cover"` and branches:
    - Cover path: calls `images.generate_cover_for_book(...)` with `book_id`, `art_style`, `layout`, `title`, `author`, `subtitle`, `model`, `job_id`.
    - Codex path: calls `images.generate_for_entity(...)` unchanged (Phase-1 path).
  - Existing sanitized failure handling (rollback + reload + safe_error, no re-raise) kept intact for both branches.

### Modified (tests)
- `apps/ai/tests/integration/test_image_service.py`
  - Added `from alexandria_core.models.book import Book` import.
  - Added `_make_book(db, project_id, title, author) -> uuid.UUID` helper.
  - Added `test_generate_cover_for_book_persists_cover_asset` — monkeypatches `router.generate_image` with a fake returning a 1024×1536 PNG; asserts `entity_type="cover"`, `status="ready"`, `style="cover_fantasy"`, `width=1600`, `height=2560`.
  - Added `test_generate_cover_for_book_missing_book_raises` — asserts `ValueError` for unknown book/project.

- `apps/ai/tests/integration/test_image_job.py`
  - Added `from types import SimpleNamespace` import.
  - Added `from alexandria_core.models.book import Book` import.
  - Added `_make_book(db, project_id, title, author) -> uuid.UUID` helper.
  - Added `_single_session_factory = _session_factory` alias.
  - Added `test_image_job_cover_branch` — creates a cover job, monkeypatches `generate_cover_for_book` on an `ImageService` instance, runs `_run_image_job`, asserts `JobStatus.DONE` and that `art_style`/`layout` were forwarded correctly.

## Test Commands + Results

```
uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_image_service.py -k cover
# → 2 failed (before impl) — confirmed fail

uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_image_job.py -k cover
# → 1 failed (before impl) — confirmed fail

uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_image_service.py tests/integration/test_image_job.py
# → 18 passed

uv run --directory apps/ai pytest -q -p no:cacheprovider
# → 330 passed, 6 skipped (full suite — no regressions)

uv run --directory apps/ai ruff check app/services/image_service.py app/jobs/image_job.py tests/integration/test_image_service.py tests/integration/test_image_job.py
# → All checks passed!
```

## Helper Additions

- `_make_book` added to both test modules (inserts a `Book` row under the given project, returns `book.id`).
- `_single_session_factory` alias added in `test_image_job.py` (points to existing `_session_factory` shim).

## Concerns

None. The `async def fake_cover` in the job test has no `await` (IDE warning S7503) — this is harmless; pytest-asyncio accepts async test helpers regardless, and the function's async signature is required by the monkeypatch contract (the real `generate_cover_for_book` is async). The ruff linter passes; the IDE warning is a sonarqube-style style hint only.
