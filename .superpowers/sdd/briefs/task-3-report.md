# Task 3 Report: Cover art-style presets + `build_cover_prompt`

## Status

DONE — all tests pass, ruff clean, no uncommitted commits.

---

## Files Created

| File | Notes |
|---|---|
| `packages/prompts/hu/cover_styles/cover_fantasy.md` | Epic fantasy, cinematic painterly illustration |
| `packages/prompts/hu/cover_styles/cover_literary.md` | Restrained literary/photographic, muted palette |
| `packages/prompts/hu/cover_styles/cover_thriller.md` | High-contrast suspense, noir-influenced |
| `packages/prompts/hu/cover_styles/cover_romance.md` | Warm soft-light, golden hour tones |
| `packages/prompts/hu/cover_styles/cover_minimal.md` | Bold minimalist graphic, flat geometric |

All five use the `STYLE block\n---\nbody` format. Every STYLE block contains:
- `NO text, letters, words, title, logo, signature, or watermark` — satisfies `"no text" in low`
- `negative space` or `space for an overlaid title` — satisfies `"negative space" in low or "space for" in low`

Body tokens in all five: `{title}`, `{genre}`, `{synopsis}`.

---

## Files Modified

| File | Change |
|---|---|
| `apps/ai/app/services/image_prompt.py` | Added `COVER_STYLES`, `_cover_styles_dir()`, `_cover_loader`, `available_cover_styles()`, `build_cover_prompt(book, art_style)` below Phase-1 code |
| `apps/ai/tests/unit/test_image_prompt.py` | Added 4 Task-3 tests: `test_available_cover_styles_nonempty`, `test_build_cover_prompt_fills_tokens_and_forbids_text`, `test_build_cover_prompt_blank_fields_fall_back`, `test_build_cover_prompt_unknown_style_raises` |

---

## Test Results

**Before implementation (failing):**
```
uv run --directory apps/ai pytest -q -p no:cacheprovider tests/unit/test_image_prompt.py -k cover
4 failed, 9 deselected in 0.18s
```

**After implementation (passing):**
```
uv run --directory apps/ai pytest -q -p no:cacheprovider tests/unit/test_image_prompt.py
13 passed in 0.03s
```
(9 Phase-1 tests + 4 new Task-3 tests — all green.)

---

## Ruff Result

```
uv run --directory apps/ai ruff check app/services/image_prompt.py
All checks passed!
```

---

## Wording choices for the 5 presets

Each preset STYLE block was written with distinct visual direction while keeping the mandatory "NO text" + negative-space clause:

- **cover_literary**: "Restrained literary book-cover art, photographic or fine-art quality, muted desaturated palette … space for an overlaid title."
- **cover_fantasy**: (verbatim from plan) "Epic fantasy book-cover illustration … negative space in the upper third."
- **cover_thriller**: "High-contrast thriller … tense cinematic atmosphere … space for an overlaid title."
- **cover_romance**: "Warm romantic book-cover illustration, soft diffused light, golden hour … space for an overlaid title."
- **cover_minimal**: "Bold minimalist book-cover graphic, flat geometric shapes … large clean area of negative space … space for an overlaid title."

The `cover_fantasy.md` body is verbatim from the plan. The other four bodies follow the same `{genre}/{title}/{synopsis}` pattern with genre-appropriate mood language.

---

## Concerns

- `_cover_loader` is instantiated at module import time (same pattern as Phase-1 `_loader`). If the `cover_styles/` directory is absent at import time (e.g. a Docker image built before the prompts were copied in), the `PromptLoader.__init__` succeeds (it only stores the path), but `build_cover_prompt` will raise `FileNotFoundError` at call time. This is the same behaviour as Phase-1 and is acceptable.
- The `build_cover_prompt` fallback for blank `genre` is `"általános szépirodalom"` and for blank `synopsis` is `"egy meg nem nevezett történet"`. These are Hungarian phrases matching the project's language; they ensure `{token}` and `None` are never leaked.
- Phase-1 `STYLES`/`available_styles`/`build_codex_prompt` are completely untouched. The new code is appended below a clear `# --- Cover styles (Phase 2)` separator comment.
