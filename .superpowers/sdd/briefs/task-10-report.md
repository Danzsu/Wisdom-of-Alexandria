# Task 10 — Cross-resource cover flow test

## Status: DONE

## Test file created

`apps/ai/tests/integration/test_cover_flow.py`

## What the test does

Single `@pytest.mark.integration` async test (`test_cover_end_to_end`) that walks
the complete cover pipeline with no Redis and no real provider:

1. **`POST /api/v1/ai/covers`** — monkeypatches `covers_mod.enqueue_image_job` to
   capture the job UUID instead of pushing to Redis; asserts 202, `entity_type=="cover"`,
   `status=="generating"`.
2. **Inline job run** — calls `_run_image_job(captured_id, session_factory=..., images=...)`
   directly against the test DB session. Provider is mocked via
   `ImageService(router=_fake_router())` where `_fake_router()` returns an
   `AsyncMock` whose `generate_image` returns a real 1024×1536 PNG (via
   `PIL.Image.new`). The `CoverCompositor` runs for real — bundled OFL fonts are
   used, producing an actual 1600×2560 PNG written to `tmp_path`.
3. **`GET /api/v1/ai/images?entity_type=cover&entity_id=<book_id>`** — asserts all
   returned covers have `entity_type=="cover"` and that exactly one is `status=="ready"`.
   (The POST creates a separate "generating" placeholder asset, so the list may
   contain 2 entries; the test filters to `ready` and asserts exactly 1.)
4. **`POST /api/v1/ai/images/<id>/canonical`** — asserts 200 and `is_canonical==True`.
5. **`GET /api/v1/ai/media/<id>`** — asserts 200, `content-type` starts with `image/`,
   and the response body is a valid 1600×2560 PNG (verified via `PIL.Image.open`).

## Session factory shim

Copied the `_session_factory` pattern verbatim from `test_image_job.py` — a
`@asynccontextmanager` that yields the existing `db_session` without closing it
(the fixture owns the lifecycle), enabling the job worker to reuse the test's
in-progress transaction.

## Provider mock approach

Rather than monkeypatching `image_service.router` on the module singleton
(brittle — the HTTP endpoint creates a new `ImageService()` each time via the
job runner's default), the test passes `images=ImageService(router=_fake_router())`
directly to `_run_image_job`. `_fake_router()` builds an `AsyncMock` with
`generate_image` returning a real `ImageResult(data=<1024×1536 PNG bytes>,
mime="image/png", model="gemini/x")`. This mirrors the approach in
`test_image_job.py::test_image_job_cover_branch` exactly.

## Test run

```
uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_cover_flow.py
.
1 passed in 0.22s
```

## Ruff result

```
uv run --directory apps/ai ruff check tests/integration/test_cover_flow.py
All checks passed!
```

(One import-order issue was fixed: `from unittest.mock import AsyncMock` moved into
the stdlib block above the third-party block.)

## Concerns / notes

- **Two MediaAsset rows per cover generation**: `POST /ai/covers` creates a
  `generating` placeholder asset; `generate_cover_for_book` creates a separate
  `ready` asset via the job. The `GET /ai/images` list therefore returns both.
  The test's assertion was updated to filter for `status=="ready"` covers rather
  than assuming a single-row response. This is accurate to the current design —
  no production code was changed.
- **`_session_factory` vs `_single_session_factory`**: `test_image_job.py` defines
  `_single_session_factory = _session_factory` as an alias; this test defines the
  same shim locally with the same name `_session_factory`. No shared import needed.
- No production code was added or modified.
