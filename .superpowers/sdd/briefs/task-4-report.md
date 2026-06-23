# Task 4 Report — Pillow Cover Compositor + Layouts

## Status
DONE — all tests pass, ruff clean.

## Files Created
- `apps/ai/app/services/cover_compositor.py` — Pillow typography compositor with `COVER_W`/`COVER_H` constants (1600/2560), `CoverLayout` dataclass, `LAYOUTS` registry (3 layouts: `classic_centered`, `bottom_scrim`, `top_minimal`), `available_cover_layouts()`, `_cover_crop()`, `compose_cover()`.
- `apps/ai/tests/unit/test_cover_compositor.py` — 5 unit tests covering: layout registry, exact KDP dimensions, text-over-background pixel diff, long-title wrapping, unknown-layout ValueError.

## Fonts Confirmed Present
`apps/ai/fonts/` contains:
- `Literata-Bold.ttf`
- `Inter-Bold.ttf`
- `Inter-Medium.ttf`
- `Inter-Regular.ttf`
- `OFL.txt`

Font path resolution: `_FONTS_DIR = Path(__file__).resolve().parent.parent.parent / "fonts"` — verified to resolve from `apps/ai/app/services/cover_compositor.py` → `apps/ai/fonts` (exists: True, all 4 TTFs found).

## Test Run
Command: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/unit/test_cover_compositor.py`
Result: **5 passed in 0.27s**

Tests that ran against real bundled fonts:
- `test_compose_outputs_exact_kdp_dimensions` — PASSED: output size exactly (1600, 2560), format PNG.
- `test_compose_draws_text_over_background` — PASSED: composed bytes differ from bare crop (text pixels are present).

## Ruff
Command: `uv run --directory apps/ai ruff check app/services/cover_compositor.py`
Result: **All checks passed!**

## Concerns
None. The fonts are variable-weight TTFs (copied/aliased from the same file for the three Inter weight variants). Pillow renders them at default weight; for finer per-weight control, static instances should be substituted later (V1 refinement, not MVP-blocking). The `subtitle` parameter is accepted but intentionally not drawn in MVP per spec.
