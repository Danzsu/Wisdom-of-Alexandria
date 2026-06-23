# Task 6 Report — Cover Endpoints + Schemas + Shared-Types Regen

**Date:** 2026-06-23  
**Branch:** feat/alexandria-ui  
**Status:** COMPLETE — all tests green, ruff clean

---

## Files Created

| File | Description |
|------|-------------|
| `apps/ai/app/schemas/cover.py` | `CoverGenerateRequest` + `CoverLayoutInfo` Pydantic schemas |
| `apps/ai/app/api/v1/covers.py` | `POST /ai/covers`, `GET /ai/covers/styles`, `GET /ai/covers/layouts` endpoints |
| `apps/ai/tests/integration/test_covers_endpoints.py` | 5 integration tests (TDD — written first, confirmed failing, then implemented) |

## Files Modified

| File | Change |
|------|--------|
| `apps/ai/app/api/v1/router.py` | Added `covers_router` import + `api_router.include_router(covers_router)` |

## Files Regenerated (shared-types)

| File | Change |
|------|--------|
| `packages/shared/openapi/ai.json` | Now includes `/api/v1/ai/covers`, `/api/v1/ai/covers/layouts`, `/api/v1/ai/covers/styles` paths + `CoverLayoutInfo`/`CoverGenerateRequest` schemas |
| `packages/shared/src/ai.ts` | TypeScript types regenerated from updated OpenAPI |

---

## Commands + Results

### TDD — Failing tests first
```
uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_covers_endpoints.py
# 5 failed (ModuleNotFoundError + 404s — router not mounted)
```

### After implementation
```
uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_covers_endpoints.py
# 5 passed in 0.14s
```

### Full suite
```
uv run --directory apps/ai pytest -q -p no:cacheprovider
# 335 passed, 6 skipped in 2.59s
```

### Ruff check (Task 6 files)
```
uv run --directory apps/ai ruff check app/api/v1/covers.py app/schemas/cover.py app/api/v1/router.py tests/integration/test_covers_endpoints.py
# All checks passed!
```

### Ruff check (full)
```
uv run --directory apps/ai ruff check
# 2 errors in tests/unit/test_image_prompt.py (E402 — pre-existing from Task 3, not introduced by Task 6)
```

### Shared-types regen
```
bash scripts/gen-shared-types.sh
# packages/shared/openapi/api.json + src/api.ts
# packages/shared/openapi/ai.json  + src/ai.ts
```

---

## Validation-Order Confirmation

All 422s in `POST /ai/covers` are raised **BEFORE** any DB create and **OUTSIDE** the try block, exactly mirroring `images.py`:

1. `art_style not in valid slugs` → 422 (line ~45)
2. `layout not in valid slugs` → 422 (line ~48)
3. `book is None` → 422 (line ~52)
4. `model is None` → 422 (line ~56)

Only after all four pass does the code proceed to `db.add(asset) / db.commit()`. The enqueue failure path marks both job + asset `failed` and raises a **fixed** 502 message (exception is never echoed, only logged via `safe_error`).

---

## Router Mount

Added to `apps/ai/app/api/v1/router.py` (same include style as `images_router`):
```python
from app.api.v1.covers import router as covers_router
api_router.include_router(covers_router)
```

The router prefix is `/ai` (matching `images_router`), so full paths are:
- `POST /api/v1/ai/covers`
- `GET  /api/v1/ai/covers/styles`
- `GET  /api/v1/ai/covers/layouts`

---

## Concerns

1. **Pre-existing ruff E402 in `test_image_prompt.py`** (Task 3 artifact): Two module-level imports appear after test code in that file. Not introduced by Task 6 — confirmed by `git stash` check. The controller should fix these in the Task 3 commit or a follow-up.

2. **`_make_provider_with_image_model` naming**: The plan referenced this helper name; `test_images_endpoints.py` uses `_make_image_provider` instead. Task 6's test file defines `_make_provider_with_image_model` locally as a thin wrapper accepting an explicit `image_model` string (needed for the happy-path test), following the "check the real name and reuse/extend" instruction.

3. **Shared-types freshness**: The regenerated `packages/shared/openapi/ai.json` and `src/ai.ts` are uncommitted per policy — left for the controller to commit alongside the production files.
