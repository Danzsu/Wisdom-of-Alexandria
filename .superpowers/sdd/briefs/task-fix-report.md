# Task Fix Report: Single-Asset Lifecycle Bug

## STATUS: COMPLETE — all adversarial tests pass, full suite green (343 passed, 6 skipped), ruff clean.

---

## Bug Summary

`generate_for_entity` and `generate_cover_for_book` in `image_service.py` always called `uuid.uuid4()` and `MediaAsset(...)` unconditionally on success, creating a brand-new row. The endpoint's placeholder row (status="generating") was never updated. Result: two rows per generation, placeholder stuck `generating` forever, FE spinner never stopped. The job failure handler also never touched the placeholder, so a failure also left it stuck `generating`.

---

## Signature Changes

### `apps/ai/app/services/image_service.py`

Both methods gained a required `asset_id: uuid.UUID` parameter (positional-keyword):

```python
# Before
async def generate_for_entity(self, db, *, project_id, entity_type, entity_id,
                               style, model, job_id=None) -> MediaAsset

# After
async def generate_for_entity(self, db, *, project_id, entity_type, entity_id,
                               style, model, asset_id: uuid.UUID, job_id=None) -> MediaAsset

# Before
async def generate_cover_for_book(self, db, *, project_id, book_id, art_style,
                                   layout, title, author, subtitle, model,
                                   job_id=None) -> MediaAsset

# After
async def generate_cover_for_book(self, db, *, project_id, book_id, art_style,
                                   layout, title, author, subtitle, model,
                                   asset_id: uuid.UUID, job_id=None) -> MediaAsset
```

Both methods now:
1. Load `asset = await db.get(MediaAsset, asset_id)` first; raise `ValueError` if missing.
2. Remove the `asset_id = uuid.uuid4()` + `MediaAsset(...)` construction entirely.
3. On success, mutate the existing placeholder fields in-place (file_path, thumb_path, mime, width, height, model_name, prompt, status="ready") and commit.

---

## Endpoint Changes

### `apps/ai/app/api/v1/images.py`
Added `"asset_id": str(asset.id)` to `GenerationJob.input_data` dict (one line).

### `apps/ai/app/api/v1/covers.py`
Added `"asset_id": str(asset.id)` to `GenerationJob.input_data` dict (one line).

---

## Job Changes

### `apps/ai/app/jobs/image_job.py`

1. `_REQUIRED_COMMON` extended: `("entity_type", "entity_id", "model", "asset_id")` — missing `asset_id` now fails fast with a clean error before touching the service.
2. `asset_id = uuid.UUID(str(params["asset_id"]))` extracted once before the try block.
3. Both service call sites pass `asset_id=asset_id`.
4. Failure handler (`except Exception`) now loads the placeholder after rollback + job reload:
   ```python
   from alexandria_core.models.media_asset import MediaAsset
   placeholder = await db.get(MediaAsset, asset_id)
   if placeholder is not None:
       placeholder.status = "failed"
   await db.commit()
   ```
   Guards against a missing asset (deleted between enqueue and execution).

---

## Tests Updated

### `apps/ai/tests/integration/test_image_service.py`

Added `_make_placeholder()` helper (creates a `status="generating"` MediaAsset as the endpoint does).

Updated 8 existing tests to pre-create a placeholder and pass `asset_id=placeholder.id`:
- `test_generate_for_character_writes_file_and_ready_asset` — added placeholder creation
- `test_generate_for_missing_entity_raises` — added placeholder with missing entity_id
- `test_existing_canonical_passed_as_reference` — added two separate placeholders (ph1/ph2)
- `test_set_canonical_clears_previous` — added two separate placeholders (ph1/ph2)
- `test_list_for_entity_newest_first_and_isolated` — added three placeholders (ph_older/ph_newer/ph_other)
- `test_delete_removes_row_and_files` — added placeholder
- `test_generation_failure_raises_and_leaves_no_partial` — added placeholder; updated assertion from `_count_assets == 0` to `== 1` (placeholder exists, service re-raises without mutating its status)
- `test_generate_cover_for_book_persists_cover_asset` — added placeholder
- `test_generate_cover_for_book_missing_book_raises` — added placeholder with missing book_id

### `apps/ai/tests/integration/test_image_job.py`

Added `_make_placeholder()` helper (same pattern). Updated `_input()` helper to always include `asset_id`.

Updated 5 existing tests:
- `test_image_job_runs_and_records_media_asset` — pre-create placeholder, assert `asset_id` forwarded, assert output_data uses placeholder.id
- `test_image_job_is_running_when_generate_executes` — pre-create placeholder
- `test_image_job_failure_is_persisted_and_sanitized` — pre-create placeholder
- `test_image_job_missing_required_input_fails` — pre-create placeholder
- `test_image_job_cover_branch` — pre-create placeholder, `input_data` now includes `asset_id`, assert `calls["asset_id"] == placeholder.id`

### `apps/ai/tests/integration/test_cover_flow.py`

Step 6 comment updated (removed "job creates a separate 'ready' asset"). Assertions tightened:
- `len(all_covers) == 1` (was: checking `ready_covers`, allowed two rows)
- `cover_id == post_body["id"]` — enforces that the job updated the placeholder, not a new row

---

## Adversarial Tests Added (6 total — all FAILED before fix, PASS after)

### `test_image_service.py` (3 new)

| Test | What it proves | Before fix | After fix |
|------|---------------|------------|-----------|
| `test_generate_for_entity_updates_placeholder_not_creates_new` | Exactly 1 MediaAsset after codex generation, same id as placeholder, status="ready" | FAIL (2 rows) | PASS |
| `test_generate_cover_for_book_updates_placeholder_not_creates_new` | Same invariant for cover branch | FAIL (2 rows) | PASS |
| `test_generate_for_entity_missing_placeholder_raises` | ValueError when asset_id not found | FAIL (no such guard) | PASS |

### `test_image_job.py` (3 new)

| Test | What it proves | Before fix | After fix |
|------|---------------|------------|-----------|
| `test_image_job_codex_passes_asset_id_to_service` | Job forwards `asset_id` to service; output_data uses placeholder.id | FAIL (no forwarding) | PASS |
| `test_image_job_failure_flips_placeholder_to_failed` | Codex placeholder status="failed" after provider crash | FAIL (stuck "generating") | PASS |
| `test_image_job_cover_failure_flips_placeholder_to_failed` | Cover placeholder status="failed" after compositor crash | FAIL (stuck "generating") | PASS |

---

## Full Suite

- **343 passed, 6 skipped** (6 skipped are `@pytest.mark.postgres` pgvector tests, unchanged)
- `uv run ruff check app tests` — **All checks passed!**

---

## Concerns / Notes

- The `asset_id` parameter is now **required** (not optional) on both service methods. Any caller outside tests that called the service directly without it will get a `TypeError` at call time. No such callers were found in the codebase (only the job calls the service).
- The failure handler imports `MediaAsset` inside the `except` block to avoid a circular import at module level (the model is already imported in the service; the job avoids it at top level for the same reason the existing job code avoids it). This is a minor style oddity but correct.
- The `_input()` helper in `test_image_job.py` now generates a random `asset_id` as default if none passed. Tests that don't care about the specific id will get a random uuid that won't match any DB row — those tests mock the service anyway (AsyncMock), so the job's `db.get(MediaAsset, asset_id)` in the failure handler may return `None`, which is guarded.
