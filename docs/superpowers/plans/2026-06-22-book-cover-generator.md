# Book Cover Generator (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a book's ebook front cover — AI background art (via the existing Google image provider) with app-side composite typography (title/author/subtitle) — reusing the Phase-1 image infrastructure.

**Architecture:** A cover is a `MediaAsset(entity_type="cover", entity_id=book_id)`. `POST /ai/covers` validates + creates a `generating` asset and a `GenerationJob` (type `image`) whose `input_data` JSON carries the cover inputs; the RQ image job branches on `entity_type=="cover"` → builds a cover prompt → `ModelRouter.generate_image(aspect_ratio="2:3")` (art only, told to leave text-free space) → `CoverCompositor` (Pillow) crops to exactly 1600×2560 and draws the typography per the chosen layout → `save_image` → `ready`. List/canonical/delete/`/ai/media` and the FE blob/object-URL hooks reuse Phase 1 unchanged. To change layout/text the user regenerates. No new `MediaAsset` columns; the only schema change is a new `Book.author` field.

**Tech Stack:** FastAPI + Pydantic 2 (apps/ai, apps/api), SQLAlchemy 2 async + Alembic, Pillow (compositing), RQ (jobs), `google-genai` (provider), Next.js 15 + TanStack Query + Zod + Vitest/MSW (apps/web), pytest/httpx (backend).

**Spec:** `docs/superpowers/specs/2026-06-22-book-cover-generator-design.md`

---

## File Structure

**Backend (apps/ai), create:**
- `apps/ai/app/services/cover_compositor.py` — Pillow typography compositor + `LAYOUTS` registry + `available_cover_layouts()`.
- `apps/ai/app/api/v1/covers.py` — `POST /ai/covers`, `GET /ai/covers/styles`, `GET /ai/covers/layouts`.
- `apps/ai/app/schemas/cover.py` — `CoverGenerateRequest`, `CoverLayoutInfo`.
- `apps/ai/fonts/` — bundled `Literata-Bold.ttf`, `Inter-Bold.ttf`, `Inter-Medium.ttf`, `Inter-Regular.ttf` + `OFL.txt`.
- `packages/prompts/hu/cover_styles/*.md` — 5 cover art-style presets.

**Backend, modify:**
- `apps/ai/app/services/image_prompt.py` — add `COVER_STYLES`, `available_cover_styles()`, `build_cover_prompt(book, art_style)`.
- `apps/ai/app/services/image_service.py` — add `generate_cover_for_book(...)`.
- `apps/ai/app/jobs/image_job.py` — branch the job on `entity_type=="cover"`.
- `apps/ai/app/main.py` (or the v1 router aggregator) — include the covers router.
- `packages/db/alexandria_core/models/book.py` — add `author` column.
- `apps/api/app/schemas/book.py` — `author` on Create/Update/Read.
- `apps/api/alembic/versions/<rev>_add_book_author.py` — new migration.

**Frontend (apps/web), create:**
- `apps/web/lib/api/covers.ts` — `generateCover`, `listCoverStyles`, `listCoverLayouts`.
- `apps/web/lib/api/cover-hooks.ts` — `useGenerateCover`, `useCoverStyles`, `useCoverLayouts`.
- `apps/web/components/book/cover-panel.tsx` — the cover UI.

**Frontend, modify:**
- `apps/web/lib/api/types.ts` — `author` on `bookReadSchema`/`bookCreateSchema`/`bookUpdateSchema`; add `coverLayoutInfoSchema`.
- `apps/web/app/(app)/konyv/[bookId]/beallitasok/page.tsx` — mount `CoverPanel` + add `author` field.
- `apps/web/lib/i18n/hu.ts` — `covers` block.
- `apps/web/test/msw/handlers.ts` + `fixtures.ts` — `/ai/covers*` mocks.
- `packages/shared/src/{api,ai}.ts` + `openapi/*.json` — regenerated.

**Reused unchanged:** `MediaAsset`, `ModelRouter.generate_image`, `image_storage`, `GenerationJob`/`enqueue_image_job`, `GET /ai/images`, `POST /ai/images/{id}/canonical`, `DELETE /ai/images/{id}`, `GET /ai/media/{id}`, FE `useEntityImages`/`useSetCanonical`/`useDeleteImage`/`useMediaObjectUrl`/`fetchMediaBlob`/`MediaThumb`.

**Commit policy:** This repo requires asking permission before each commit and never pushing unasked. Under subagent-driven execution the controller commits after the two-stage review; implementer subagents must NOT run `git commit`. The commit step in each task is the controller's checkpoint.

---

## Task 1: `Book.author` field — model, migration, backend schema

**Files:**
- Modify: `packages/db/alexandria_core/models/book.py`
- Create: `apps/api/alembic/versions/<rev>_add_book_author.py`
- Modify: `apps/api/app/schemas/book.py`
- Test: `apps/api/tests/integration/test_books.py` (extend; if absent, create)

- [ ] **Step 1: Write the failing test** — Book create/read round-trips `author`.

In `apps/api/tests/integration/test_books.py` add (mirror the existing book-endpoint test style — `client`, `auth_headers`, a project fixture):

```python
@pytest.mark.integration
async def test_book_author_round_trips(client, auth_headers, project_id):
    created = await client.post(
        "/api/v1/books",
        headers=auth_headers,
        json={"project_id": str(project_id), "title": "Fárosz", "author": "Rácz Dániel"},
    )
    assert created.status_code == 201
    assert created.json()["author"] == "Rácz Dániel"

    book_id = created.json()["id"]
    patched = await client.patch(
        f"/api/v1/books/{book_id}",
        headers=auth_headers,
        json={"author": "R. Dániel"},
    )
    assert patched.status_code == 200
    assert patched.json()["author"] == "R. Dániel"
```

(If `test_books.py` / a `project_id` fixture do not exist, create them following `apps/ai/tests/integration/test_images_endpoints.py`'s `_make_project` pattern and the existing api test conftest.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `uv run --directory apps/api pytest -q -p no:cacheprovider tests/integration/test_books.py::test_book_author_round_trips`
Expected: FAIL — `author` is rejected/ignored (unknown field) or KeyError on the response.

- [ ] **Step 3: Add the column to the model**

In `packages/db/alexandria_core/models/book.py`, after the `title` column add:

```python
    # Author/byline shown on generated covers (and, later, exports). Optional —
    # single-user app has no user-profile name to default from.
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
```

- [ ] **Step 4: Add the Alembic migration**

Generate a revision file `apps/api/alembic/versions/<rev>_add_book_author.py` (set `down_revision` to the current head — find it with `uv run --directory apps/api alembic heads`):

```python
"""add books.author

Revision ID: <rev>
Revises: <current_head>
"""
import sqlalchemy as sa
from alembic import op

revision = "<rev>"
down_revision = "<current_head>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("author", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("books", "author")
```

- [ ] **Step 5: Add `author` to the API schemas**

In `apps/api/app/schemas/book.py` add to `BookCreate`, `BookUpdate` (both optional) and `BookRead`:

```python
# BookCreate / BookUpdate:
    author: str | None = Field(default=None, max_length=255)
# BookRead:
    author: str | None
```

Confirm the Book CRUD service passes through unknown-free fields (it uses the Pydantic model fields), so no CRUD change is needed beyond the schema.

- [ ] **Step 6: Run the test to confirm it passes**

Run: `uv run --directory apps/api pytest -q -p no:cacheprovider tests/integration/test_books.py::test_book_author_round_trips`
Expected: PASS. Then run the migration check: `uv run --directory apps/api alembic upgrade head && uv run --directory apps/api alembic downgrade -1 && uv run --directory apps/api alembic upgrade head` (up/down/up clean).

- [ ] **Step 7: Commit** (controller)

```bash
git add packages/db/alexandria_core/models/book.py apps/api/alembic/versions apps/api/app/schemas/book.py apps/api/tests/integration/test_books.py
git commit -m "feat(books): add Book.author field (model + migration + schema)"
```

---

## Task 2: Frontend `Book.author` (types + settings form) + shared-types regen

**Files:**
- Modify: `apps/web/lib/api/types.ts` (book schemas)
- Modify: `apps/web/app/(app)/konyv/[bookId]/beallitasok/page.tsx`
- Modify: `apps/web/lib/i18n/hu.ts`
- Regenerate: `packages/shared/openapi/api.json` + `packages/shared/src/api.ts`
- Test: `apps/web/app/(app)/konyv/[bookId]/beallitasok/__tests__/page.test.tsx` (extend or create)

- [ ] **Step 1: Regenerate shared types from the Task-1 backend change**

Run: `bash scripts/gen-shared-types.sh`
Expected: `packages/shared/openapi/api.json` + `src/api.ts` change to include `author` on the Book schemas. (The freshness CI gate requires this committed.)

- [ ] **Step 2: Write the failing test** — the settings form shows + saves `author`.

In the settings page test (create `…/beallitasok/__tests__/page.test.tsx` if needed, mirroring an existing page test that uses `renderWithProviders` + MSW), assert an Author field renders and a PATCH carries it:

```tsx
it("edits the book author", async () => {
  const user = userEvent.setup();
  const patched: Record<string, unknown>[] = [];
  server.use(
    http.patch(`${apiBase}/books/:id`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patched.push(body);
      return HttpResponse.json({ ...FAROSZ_BOOK, ...body });
    }),
  );
  renderSettings();
  const author = await screen.findByLabelText(hu.books.authorLabel);
  await user.clear(author);
  await user.type(author, "Rácz Dániel");
  await user.click(screen.getByRole("button", { name: hu.books.save }));
  await waitFor(() =>
    expect(patched.at(-1)).toMatchObject({ author: "Rácz Dániel" }),
  );
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `corepack pnpm -C apps/web exec vitest run "app/(app)/konyv/[bookId]/beallitasok"`
Expected: FAIL — no field labelled `hu.books.authorLabel`.

- [ ] **Step 4: Add `author` to the Zod book schemas**

In `apps/web/lib/api/types.ts`:

```ts
// bookReadSchema:
  author: z.string().nullable(),
// bookCreateSchema:
  author: z.string().max(255).nullable().optional(),
// bookUpdateSchema:
  author: z.string().max(255).nullable().optional(),
```

- [ ] **Step 5: Add the i18n key + the form field**

In `apps/web/lib/i18n/hu.ts`, under the existing `books` block, add:

```ts
    authorLabel: "Szerző",
    authorPlaceholder: "A könyv szerzője",
```

In `…/beallitasok/page.tsx`, add an input bound to the book's `author` in the same form/section as the existing title/genre fields (follow that section's `FormInput` + controlled-state + the existing save mutation; include `author` in the PATCH payload).

- [ ] **Step 6: Run the test to confirm it passes**

Run: `corepack pnpm -C apps/web exec vitest run "app/(app)/konyv/[bookId]/beallitasok"`
Expected: PASS. Then `corepack pnpm -C apps/web type-check` (clean — the regenerated `api.ts` ties bind).

- [ ] **Step 7: Commit** (controller)

```bash
git add apps/web/lib/api/types.ts "apps/web/app/(app)/konyv/[bookId]/beallitasok" apps/web/lib/i18n/hu.ts packages/shared
git commit -m "feat(books): edit Book.author in settings + regen shared-types"
```

---

## Task 3: Cover art-style presets + `build_cover_prompt`

**Files:**
- Create: `packages/prompts/hu/cover_styles/cover_literary.md`, `cover_fantasy.md`, `cover_thriller.md`, `cover_romance.md`, `cover_minimal.md`
- Modify: `apps/ai/app/services/image_prompt.py`
- Test: `apps/ai/tests/unit/test_image_prompt.py` (extend)

- [ ] **Step 1: Write the failing test**

Add to `apps/ai/tests/unit/test_image_prompt.py`:

```python
from types import SimpleNamespace
from app.services import image_prompt


def _book(**kw):
    base = dict(title="A Fárosz árnyéka", genre="fantasy", synopsis="Egy könyvtáros titka.")
    base.update(kw)
    return SimpleNamespace(**base)


def test_available_cover_styles_nonempty():
    slugs = {s.slug for s in image_prompt.available_cover_styles()}
    assert {"cover_literary", "cover_fantasy", "cover_minimal"} <= slugs
    assert all(s.entity_type == "cover" for s in image_prompt.available_cover_styles())


def test_build_cover_prompt_fills_tokens_and_forbids_text():
    prompt = image_prompt.build_cover_prompt(_book(), "cover_fantasy")
    assert "A Fárosz árnyéka" in prompt          # {title}
    assert "fantasy" in prompt                    # {genre}
    assert "Egy könyvtáros titka." in prompt      # {synopsis}
    # The STYLE block must forbid in-art text (we composite typography ourselves).
    low = prompt.lower()
    assert "no text" in low and ("negative space" in low or "space for" in low)


def test_build_cover_prompt_blank_fields_fall_back():
    prompt = image_prompt.build_cover_prompt(_book(genre=None, synopsis="  "), "cover_minimal")
    assert "{" not in prompt and "None" not in prompt


def test_build_cover_prompt_unknown_style_raises():
    import pytest
    with pytest.raises(ValueError):
        image_prompt.build_cover_prompt(_book(), "realistic_portrait")  # a character style
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/unit/test_image_prompt.py -k cover`
Expected: FAIL — `available_cover_styles` / `build_cover_prompt` do not exist.

- [ ] **Step 3: Create the 5 cover style presets**

Each file uses the same `STYLE block --- body` format as `image_styles/*.md`. The STYLE block MUST forbid text and ask for negative space. Tokens in the body: `{title}`, `{genre}`, `{synopsis}`. Example `packages/prompts/hu/cover_styles/cover_fantasy.md`:

```
Epic fantasy book-cover illustration, dramatic cinematic composition, rich atmospheric lighting, painterly detail, evocative mood, strong focal subject with depth, vertical book-cover framing. IMPORTANT: contain NO text, letters, words, title, logo, signature, or watermark anywhere; leave clean uncluttered negative space in the upper third suitable for an overlaid title.
---
Cover art for a {genre} novel titled "{title}". Theme and mood drawn from: {synopsis}. Symbolic, genre-appropriate imagery; no readable text in the image.
```

Create the other four with distinct art direction (`cover_literary` = restrained literary/photographic; `cover_thriller` = high-contrast suspense; `cover_romance` = warm soft-light; `cover_minimal` = bold minimalist graphic) — each keeping the same "NO text … negative space" clause and the same `{title}/{genre}/{synopsis}` body tokens.

- [ ] **Step 4: Extend `image_prompt.py`**

Add the cover registry, loader, and builder (keeps Phase-1 code untouched):

```python
# --- Cover styles (Phase 2) -------------------------------------------------

COVER_STYLES: dict[str, ImageStyle] = {
    "cover_literary": ImageStyle("cover_literary", "Irodalmi", "cover"),
    "cover_fantasy": ImageStyle("cover_fantasy", "Fantasy", "cover"),
    "cover_thriller": ImageStyle("cover_thriller", "Thriller", "cover"),
    "cover_romance": ImageStyle("cover_romance", "Romantikus", "cover"),
    "cover_minimal": ImageStyle("cover_minimal", "Minimalista", "cover"),
}


def _cover_styles_dir() -> Path:
    docker = Path("/app/prompts/hu/cover_styles")
    if docker.exists():
        return docker
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    return repo_root / "packages" / "prompts" / "hu" / "cover_styles"


_cover_loader = PromptLoader(prompts_dir=_cover_styles_dir())


def available_cover_styles() -> list[ImageStyle]:
    """Return the registered cover art-style presets."""
    return list(COVER_STYLES.values())


def build_cover_prompt(book, art_style: str) -> str:
    """Build a cover-art prompt for a Book in the given cover art-style.

    ``book`` is duck-typed: ``title``, ``genre``, ``synopsis``. The art-style must
    be a known cover style (``ValueError`` otherwise). The STYLE block forbids any
    in-art text and requests negative space (typography is composited app-side).
    Blank genre/synopsis fall back to graceful Hungarian phrases — never leaks a
    ``{token}`` or the literal ``"None"``.
    """
    if art_style not in COVER_STYLES:
        names = ", ".join(sorted(COVER_STYLES))
        raise ValueError(f"Unknown cover style {art_style!r}. Valid: {names}.")
    genre = _clean(getattr(book, "genre", None)) or "általános szépirodalom"
    synopsis = _clean(getattr(book, "synopsis", None)) or "egy meg nem nevezett történet"
    style_block = _cover_loader.load_system(art_style)
    body = _cover_loader.load_user(
        art_style, title=book.title, genre=genre, synopsis=synopsis
    )
    return f"{style_block} {body}"
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/unit/test_image_prompt.py`
Expected: PASS (existing + new). Then `uv run --directory apps/ai ruff check app/services/image_prompt.py`.

- [ ] **Step 6: Commit** (controller)

```bash
git add packages/prompts/hu/cover_styles apps/ai/app/services/image_prompt.py apps/ai/tests/unit/test_image_prompt.py
git commit -m "feat(covers): cover art-style presets + build_cover_prompt"
```

---

## Task 4: Cover compositor (Pillow) + bundled fonts + layouts

**Files:**
- Create: `apps/ai/fonts/` (TTFs + `OFL.txt`)
- Create: `apps/ai/app/services/cover_compositor.py`
- Test: `apps/ai/tests/unit/test_cover_compositor.py`

- [ ] **Step 1: Bundle the fonts (one-time asset step)**

Download the static OFL TTFs into `apps/ai/fonts/` (Literata + Inter from Google Fonts' GitHub mirror):

```bash
mkdir -p apps/ai/fonts
cd apps/ai/fonts
curl -fsSL -o Literata-Bold.ttf   "https://github.com/google/fonts/raw/main/ofl/literata/Literata%5Bopsz%2Cwght%5D.ttf"
curl -fsSL -o Inter-Bold.ttf      "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"
cp Inter-Bold.ttf Inter-Medium.ttf
cp Inter-Bold.ttf Inter-Regular.ttf
curl -fsSL -o OFL.txt "https://github.com/google/fonts/raw/main/ofl/inter/OFL.txt"
cd -
```

(Variable fonts render at a default weight via Pillow; for crisper weights, substitute static instances later. The `cp` aliases keep the layout config's filenames valid now.) Ensure `apps/ai/fonts/` is NOT git-ignored. The ai/worker Docker image copies the `apps/ai` tree, so `/app/fonts` is present at runtime.

- [ ] **Step 2: Write the failing test**

Create `apps/ai/tests/unit/test_cover_compositor.py`:

```python
import io
import pytest
from PIL import Image
from app.services import cover_compositor as cc


def _png(w=1024, h=1536, color=(20, 30, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def test_available_layouts_nonempty():
    slugs = {l.slug for l in cc.available_cover_layouts()}
    assert {"classic_centered", "bottom_scrim", "top_minimal"} <= slugs


def test_compose_outputs_exact_kdp_dimensions():
    out = cc.compose_cover(_png(), layout="classic_centered", title="A Fárosz", author="Rácz D.")
    with Image.open(io.BytesIO(out)) as img:
        assert img.size == (cc.COVER_W, cc.COVER_H) == (1600, 2560)
        assert img.format == "PNG"


def test_compose_draws_text_over_background():
    plain = _png()  # uniform colour
    out = cc.compose_cover(plain, layout="classic_centered", title="CÍM", author="SZERZŐ")
    # The composite must differ from a bare crop/resize of the same background.
    bare = cc._cover_crop(Image.open(io.BytesIO(plain)).convert("RGB"), cc.COVER_W, cc.COVER_H)
    bare_bytes = io.BytesIO(); bare.save(bare_bytes, "PNG")
    assert out != bare_bytes.getvalue()


def test_long_title_wraps_and_fits():
    long_title = "Egy nagyon hosszú cím amely biztosan több sorba törik a borítón rendben"
    out = cc.compose_cover(_png(), layout="bottom_scrim", title=long_title, author="X")
    with Image.open(io.BytesIO(out)) as img:
        assert img.size == (1600, 2560)  # did not crash; produced a valid cover


def test_unknown_layout_raises():
    with pytest.raises(ValueError):
        cc.compose_cover(_png(), layout="does_not_exist", title="t", author="a")
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/unit/test_cover_compositor.py`
Expected: FAIL — module `cover_compositor` does not exist.

- [ ] **Step 4: Implement the compositor**

Create `apps/ai/app/services/cover_compositor.py`:

```python
"""Cover typography compositor (Phase 2).

Takes generated background art and an ebook-cover layout, crops to the exact KDP
ebook size (1600x2560 / 1:1.6) and draws the title/author/optional subtitle with
bundled OFL fonts (Pillow ImageDraw). Diffusion models render text poorly, so the
art is generated text-free (see build_cover_prompt) and typography is composited
here — deterministically, per layout.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

COVER_W = 1600
COVER_H = 2560
_MARGIN = 120  # side margin in px

_FONTS_DIR = Path(__file__).resolve().parent.parent.parent / "fonts"


@dataclass(frozen=True)
class CoverLayout:
    slug: str
    label: str
    title_font: str          # ttf filename in _FONTS_DIR
    author_font: str
    anchor: str              # "top" | "center" | "bottom"
    title_color: tuple[int, int, int]
    scrim: bool              # darken the text band for legibility


LAYOUTS: dict[str, CoverLayout] = {
    "classic_centered": CoverLayout(
        "classic_centered", "Klasszikus, középre",
        "Literata-Bold.ttf", "Inter-Medium.ttf", "center", (245, 242, 236), False),
    "bottom_scrim": CoverLayout(
        "bottom_scrim", "Alsó sávban",
        "Literata-Bold.ttf", "Inter-Medium.ttf", "bottom", (255, 255, 255), True),
    "top_minimal": CoverLayout(
        "top_minimal", "Felül, minimál",
        "Inter-Bold.ttf", "Inter-Regular.ttf", "top", (255, 255, 255), True),
}


def available_cover_layouts() -> list[CoverLayout]:
    return list(LAYOUTS.values())


def _require_layout(layout: str) -> CoverLayout:
    if layout not in LAYOUTS:
        names = ", ".join(sorted(LAYOUTS))
        raise ValueError(f"Unknown cover layout {layout!r}. Valid: {names}.")
    return LAYOUTS[layout]


def _font(filename: str, size: int) -> ImageFont.FreeTypeFont:
    path = _FONTS_DIR / filename
    if not path.exists():
        raise ValueError(f"cover font missing: {path}")
    return ImageFont.truetype(str(path), size)


def _cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Scale to cover the target box, then center-crop to exactly (w, h)."""
    scale = max(w / img.width, h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)))
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def _wrap(draw, text: str, font, max_w: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if not cur or draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or [text]


def _fit(draw, text: str, font_file: str, max_w: int, max_size: int, min_size: int = 28):
    size = max_size
    while size >= min_size:
        font = _font(font_file, size)
        lines = _wrap(draw, text, font, max_w)
        if all(draw.textlength(ln, font=font) <= max_w for ln in lines):
            return font, lines
        size -= 4
    font = _font(font_file, min_size)
    return font, _wrap(draw, text, font, max_w)


def _apply_scrim(canvas: Image.Image, anchor: str) -> None:
    """Darken a vertical band behind the text for legibility."""
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    band = COVER_H // 2
    if anchor == "top":
        od.rectangle((0, 0, COVER_W, band), fill=(0, 0, 0, 130))
    elif anchor == "bottom":
        od.rectangle((0, COVER_H - band, COVER_W, COVER_H), fill=(0, 0, 0, 150))
    else:  # center
        od.rectangle((0, COVER_H // 3, COVER_W, COVER_H * 2 // 3), fill=(0, 0, 0, 110))
    canvas.paste(Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB"), (0, 0))


def compose_cover(
    background_png: bytes,
    *,
    layout: str,
    title: str,
    author: str,
    subtitle: str | None = None,
) -> bytes:
    """Composite typography onto the background; return a 1600x2560 PNG."""
    spec = _require_layout(layout)
    with Image.open(io.BytesIO(background_png)) as bg:
        bg.load()
        canvas = _cover_crop(bg.convert("RGB"), COVER_W, COVER_H)

    if spec.scrim:
        _apply_scrim(canvas, spec.anchor)

    draw = ImageDraw.Draw(canvas)
    max_w = COVER_W - 2 * _MARGIN
    title_font, title_lines = _fit(draw, title, spec.title_font, max_w, max_size=150)
    author_font = _font(spec.author_font, 64)

    title_h = sum(
        (draw.textbbox((0, 0), ln, font=title_font)[3]) + 12 for ln in title_lines
    )
    author_h = draw.textbbox((0, 0), author, font=author_font)[3] if author else 0
    block_h = title_h + (author_h + 40 if author else 0)

    if spec.anchor == "top":
        y = _MARGIN + 40
    elif spec.anchor == "bottom":
        y = COVER_H - _MARGIN - block_h
    else:
        y = (COVER_H - block_h) // 2

    for ln in title_lines:
        w = draw.textlength(ln, font=title_font)
        draw.text(((COVER_W - w) / 2, y), ln, font=title_font, fill=spec.title_color)
        y += draw.textbbox((0, 0), ln, font=title_font)[3] + 12

    if author:
        y += 28
        w = draw.textlength(author, font=author_font)
        draw.text(((COVER_W - w) / 2, y), author, font=author_font, fill=spec.title_color)

    out = io.BytesIO()
    canvas.save(out, "PNG")
    return out.getvalue()
```

(Subtitle support is intentionally minimal in MVP — the parameter is accepted; drawing it is a later refinement. Do NOT add it speculatively.)

- [ ] **Step 5: Run the test to confirm it passes**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/unit/test_cover_compositor.py`
Expected: PASS. Then `uv run --directory apps/ai ruff check app/services/cover_compositor.py`.

- [ ] **Step 6: Commit** (controller)

```bash
git add apps/ai/fonts apps/ai/app/services/cover_compositor.py apps/ai/tests/unit/test_cover_compositor.py
git commit -m "feat(covers): Pillow cover compositor + layouts + bundled OFL fonts"
```

---

## Task 5: ImageService cover flow + job branch

**Files:**
- Modify: `apps/ai/app/services/image_service.py`
- Modify: `apps/ai/app/jobs/image_job.py`
- Test: `apps/ai/tests/integration/test_image_service.py` + `apps/ai/tests/integration/test_image_job.py` (extend)

- [ ] **Step 1: Write the failing service test**

Add to `apps/ai/tests/integration/test_image_service.py` (mirror the existing `_make_project` / mocked-router pattern already used there):

```python
@pytest.mark.integration
async def test_generate_cover_for_book_persists_cover_asset(db_session, monkeypatch, tmp_path):
    from alexandria_core.core.config import settings
    monkeypatch.setattr(settings, "media_dir", str(tmp_path))

    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id, title="Fárosz", author="Rácz D.")

    async def fake_generate_image(prompt, *, model, db, reference_images=None, aspect_ratio="2:3", **kw):
        from app.services.model_router import ImageResult
        import io
        from PIL import Image
        buf = io.BytesIO(); Image.new("RGB", (1024, 1536), (10, 20, 30)).save(buf, "PNG")
        return ImageResult(data=buf.getvalue(), mime="image/png", model=model)

    svc = ImageService()
    monkeypatch.setattr(svc.router, "generate_image", fake_generate_image)

    asset = await svc.generate_cover_for_book(
        db_session, project_id=project_id, book_id=book_id,
        art_style="cover_fantasy", layout="classic_centered",
        title="Fárosz", author="Rácz D.", subtitle=None, model="gemini/x",
    )
    assert asset.entity_type == "cover"
    assert asset.entity_id == book_id
    assert asset.status == "ready"
    assert asset.style == "cover_fantasy"
    assert asset.width == 1600 and asset.height == 2560


@pytest.mark.integration
async def test_generate_cover_for_book_missing_book_raises(db_session):
    import uuid
    svc = ImageService()
    with pytest.raises(ValueError):
        await svc.generate_cover_for_book(
            db_session, project_id=uuid.uuid4(), book_id=uuid.uuid4(),
            art_style="cover_fantasy", layout="classic_centered",
            title="t", author="a", subtitle=None, model="m",
        )
```

(Add a `_make_book` helper in that test module if absent: insert a `Book` row with the given title/author under the project.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_image_service.py -k cover`
Expected: FAIL — `generate_cover_for_book` does not exist.

- [ ] **Step 3: Implement `generate_cover_for_book`**

In `apps/ai/app/services/image_service.py`, import at top:

```python
from alexandria_core.models.book import Book
from app.services import cover_compositor
```

Add this method to `ImageService` (alongside `generate_for_entity`):

```python
    async def generate_cover_for_book(
        self,
        db: AsyncSession,
        *,
        project_id: uuid.UUID,
        book_id: uuid.UUID,
        art_style: str,
        layout: str,
        title: str,
        author: str,
        subtitle: str | None,
        model: str,
        job_id: uuid.UUID | None = None,
    ) -> MediaAsset:
        """Generate a book cover: art (text-free) → composite typography → READY
        ``MediaAsset(entity_type="cover", entity_id=book_id)``. Loud on failure
        (cleans up a partial file, re-raises). Raises ``ValueError`` if the book
        is missing."""
        book = await db.get(Book, book_id)
        if book is None or book.project_id != project_id:
            raise ValueError(f"book {book_id} not found for cover generation")

        prompt = image_prompt.build_cover_prompt(book, art_style)
        asset_id = uuid.uuid4()
        saved: SavedImage | None = None
        try:
            result = await self.router.generate_image(
                prompt, model=model, db=db, aspect_ratio="2:3"
            )
            composed = cover_compositor.compose_cover(
                result.data, layout=layout, title=title, author=author, subtitle=subtitle
            )
            from alexandria_core.core.config import settings

            saved = save_image(
                settings.media_dir, project_id, asset_id, composed, "image/png"
            )
        except Exception:
            if saved is not None:
                delete_image_files(saved.file_path, saved.thumb_path)
            raise

        asset = MediaAsset(
            id=asset_id,
            project_id=project_id,
            entity_type="cover",
            entity_id=book_id,
            status="ready",
            file_path=saved.file_path,
            thumb_path=saved.thumb_path,
            mime="image/png",
            width=saved.width,
            height=saved.height,
            model_name=result.model,
            style=art_style,
            prompt=prompt,
            job_id=job_id,
            is_canonical=False,
        )
        db.add(asset)
        await db.commit()
        await db.refresh(asset)
        return asset
```

- [ ] **Step 4: Write the failing job-branch test**

Add to `apps/ai/tests/integration/test_image_job.py`:

```python
@pytest.mark.integration
async def test_image_job_cover_branch(db_session, monkeypatch):
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id)

    job = GenerationJob(
        job_type=JobType.IMAGE, project_id=project_id, status=JobStatus.PENDING,
        model_name="gemini/x",
        input_data={
            "entity_type": "cover", "entity_id": str(book_id),
            "art_style": "cover_fantasy", "layout": "classic_centered",
            "title": "Fárosz", "author": "Rácz D.", "subtitle": None, "model": "gemini/x",
        },
    )
    db_session.add(job); await db_session.commit(); await db_session.refresh(job)

    calls = {}
    async def fake_cover(db, **kw):
        calls.update(kw)
        return SimpleNamespace(id=uuid.uuid4())
    images = ImageService()
    monkeypatch.setattr(images, "generate_cover_for_book", fake_cover)

    await _run_image_job(job.id, session_factory=_single_session_factory(db_session), images=images)
    refreshed = await get_job(db_session, job.id)
    assert refreshed.status == JobStatus.DONE
    assert calls["art_style"] == "cover_fantasy" and calls["layout"] == "classic_centered"
```

(Reuse the existing helpers in that test module — `_make_project`, `_run_image_job` wiring, and the session-factory shim already used by the Phase-1 image-job tests.)

- [ ] **Step 5: Implement the job branch**

In `apps/ai/app/jobs/image_job.py`, replace the single-path generate call with a branch on `entity_type`. Change the required-keys check + the `try` body:

```python
# Replace the module constant:
_REQUIRED_COMMON = ("entity_type", "entity_id", "model")
_REQUIRED_COVER = ("art_style", "layout")
_REQUIRED_CODEX = ("style",)
```

In `_run_image_job`, compute the required set by entity_type and branch the call:

```python
        params = job.input_data or {}
        is_cover = params.get("entity_type") == "cover"
        required = _REQUIRED_COMMON + (_REQUIRED_COVER if is_cover else _REQUIRED_CODEX)
        missing = [k for k in required if not params.get(k)]
        if missing:
            job.status = JobStatus.FAILED
            job.error_message = "A képgenerálási feladatból hiányzó mező: " + ", ".join(missing)
            await db.commit()
            logger.error("Image job %s missing input fields: %s", job_id, missing)
            return

        job.status = JobStatus.RUNNING
        await db.commit()

        try:
            if is_cover:
                asset = await images.generate_cover_for_book(
                    db,
                    project_id=job.project_id,
                    book_id=uuid.UUID(str(params["entity_id"])),
                    art_style=params["art_style"],
                    layout=params["layout"],
                    title=params.get("title") or "",
                    author=params.get("author") or "",
                    subtitle=params.get("subtitle"),
                    model=params["model"],
                    job_id=job.id,
                )
            else:
                asset = await images.generate_for_entity(
                    db,
                    project_id=job.project_id,
                    entity_type=params["entity_type"],
                    entity_id=uuid.UUID(str(params["entity_id"])),
                    style=params["style"],
                    model=params["model"],
                    job_id=job.id,
                )
            job.output_data = {"media_asset_id": str(asset.id)}
            job.status = JobStatus.DONE
            await db.commit()
        except Exception as exc:
            await db.rollback()
            failed = await get_job(db, job_id)
            if failed is not None:
                failed.status = JobStatus.FAILED
                failed.error_message = safe_error(exc)
                await db.commit()
            logger.error("Image job %s failed: %s", job_id, safe_error(exc))
```

- [ ] **Step 6: Run both tests to confirm they pass**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_image_service.py tests/integration/test_image_job.py`
Expected: PASS (existing + new). Then `uv run --directory apps/ai ruff check app/services/image_service.py app/jobs/image_job.py`.

- [ ] **Step 7: Commit** (controller)

```bash
git add apps/ai/app/services/image_service.py apps/ai/app/jobs/image_job.py apps/ai/tests/integration/test_image_service.py apps/ai/tests/integration/test_image_job.py
git commit -m "feat(covers): ImageService.generate_cover_for_book + image job cover branch"
```

---

## Task 6: Cover endpoints + schemas + shared-types regen

**Files:**
- Create: `apps/ai/app/schemas/cover.py`
- Create: `apps/ai/app/api/v1/covers.py`
- Modify: `apps/ai/app/main.py` (include the router)
- Test: `apps/ai/tests/integration/test_covers_endpoints.py`
- Regenerate: `packages/shared/openapi/ai.json` + `src/ai.ts`

- [ ] **Step 1: Write the failing endpoint tests**

Create `apps/ai/tests/integration/test_covers_endpoints.py` (mirror `test_images_endpoints.py` fixtures + a monkeypatched `enqueue_image_job`):

```python
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


async def test_post_cover_unknown_book_is_422(client: AsyncClient, auth_headers, db_session):
    resp = await client.post("/api/v1/ai/covers", headers=auth_headers, json={
        "book_id": str(uuid.uuid4()), "art_style": "cover_fantasy", "layout": "classic_centered"})
    assert resp.status_code == 422


async def test_post_cover_bad_style_is_422(client, auth_headers, db_session):
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id)
    resp = await client.post("/api/v1/ai/covers", headers=auth_headers, json={
        "book_id": str(book_id), "art_style": "realistic_portrait", "layout": "classic_centered"})
    assert resp.status_code == 422


async def test_post_cover_bad_layout_is_422(client, auth_headers, db_session):
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id)
    resp = await client.post("/api/v1/ai/covers", headers=auth_headers, json={
        "book_id": str(book_id), "art_style": "cover_fantasy", "layout": "nope"})
    assert resp.status_code == 422


async def test_post_cover_happy_path_creates_generating_asset(client, auth_headers, db_session, monkeypatch):
    import app.api.v1.covers as covers_mod
    enq = []
    monkeypatch.setattr(covers_mod, "enqueue_image_job", lambda jid: enq.append(jid))
    # ensure an image model resolves (seed an enabled provider with image_model)
    await _make_provider_with_image_model(db_session, "gemini/x")
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id, title="Fárosz", author="Rácz D.")
    resp = await client.post("/api/v1/ai/covers", headers=auth_headers, json={
        "book_id": str(book_id), "art_style": "cover_fantasy", "layout": "classic_centered"})
    assert resp.status_code == 202
    body = resp.json()
    assert body["entity_type"] == "cover" and body["status"] == "generating"
    assert body["style"] == "cover_fantasy"
    assert len(enq) == 1


async def test_get_cover_styles_and_layouts(client, auth_headers):
    s = await client.get("/api/v1/ai/covers/styles", headers=auth_headers)
    assert s.status_code == 200 and any(x["slug"] == "cover_fantasy" for x in s.json())
    l = await client.get("/api/v1/ai/covers/layouts", headers=auth_headers)
    assert l.status_code == 200 and any(x["slug"] == "classic_centered" for x in l.json())
```

(Reuse/extend the helpers from `test_images_endpoints.py`: `_make_project`, `_make_book`, `_make_provider_with_image_model`.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_covers_endpoints.py`
Expected: FAIL — `/ai/covers` 404 (router not mounted).

- [ ] **Step 3: Add the schemas**

Create `apps/ai/app/schemas/cover.py`:

```python
"""Schemas for the cover-generation HTTP layer (Phase 2)."""
import uuid
from pydantic import BaseModel, Field


class CoverGenerateRequest(BaseModel):
    book_id: uuid.UUID
    art_style: str = Field(min_length=1)
    layout: str = Field(min_length=1)
    title: str | None = None      # defaults to book.title
    author: str | None = None     # defaults to book.author
    subtitle: str | None = None
    model: str | None = None      # defaults to the provider's image_model


class CoverLayoutInfo(BaseModel):
    slug: str
    label: str
```

- [ ] **Step 4: Implement the endpoints**

Create `apps/ai/app/api/v1/covers.py`:

```python
"""Book cover generation HTTP layer (Phase 2).

POST /ai/covers enqueues a cover job (a MediaAsset with entity_type="cover").
Validation 422s are raised BEFORE any create and OUTSIDE the try, so they are
never re-wrapped into the enqueue 502. List/canonical/delete/serve reuse the
Phase-1 /ai/images + /ai/media endpoints (entity_type="cover").
"""
import logging
import uuid

from alexandria_core.core.deps import get_current_user, get_db
from alexandria_core.core.errors import safe_error
from alexandria_core.models.book import Book
from alexandria_core.models.generation_job import GenerationJob, JobStatus, JobType
from alexandria_core.models.media_asset import MediaAsset
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.images import _resolve_image_model
from app.schemas.cover import CoverGenerateRequest, CoverLayoutInfo
from app.schemas.media_asset import ImageStyleInfo
from app.services.cover_compositor import available_cover_layouts
from app.services.image_prompt import available_cover_styles
from app.services.job_queue import enqueue_image_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["covers"])


@router.post("/covers", response_model=MediaAssetRead, status_code=status.HTTP_202_ACCEPTED)
async def generate_cover(
    data: CoverGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> MediaAssetRead:
    # ── Validation (all 422s, BEFORE any create, OUTSIDE the try) ──
    if data.art_style not in {s.slug for s in available_cover_styles()}:
        raise HTTPException(status_code=422, detail="invalid cover art_style")
    if data.layout not in {l.slug for l in available_cover_layouts()}:
        raise HTTPException(status_code=422, detail="invalid cover layout")

    book = await db.get(Book, data.book_id)
    if book is None:
        raise HTTPException(status_code=422, detail="book_id does not exist")

    model = data.model or await _resolve_image_model(db)
    if model is None:
        raise HTTPException(status_code=422, detail="no image model configured")

    title = (data.title or book.title or "").strip()
    author = (data.author if data.author is not None else (book.author or "")).strip()

    # ── Create + enqueue ──
    asset = MediaAsset(
        status="generating", project_id=book.project_id,
        entity_type="cover", entity_id=book.id, style=data.art_style, model_name=model,
    )
    db.add(asset); await db.commit(); await db.refresh(asset)

    job = GenerationJob(
        job_type=JobType.IMAGE, project_id=book.project_id, status=JobStatus.PENDING,
        model_name=model,
        input_data={
            "entity_type": "cover", "entity_id": str(book.id),
            "art_style": data.art_style, "layout": data.layout,
            "title": title, "author": author, "subtitle": data.subtitle, "model": model,
        },
    )
    db.add(job); await db.commit(); await db.refresh(job)
    asset.job_id = job.id; await db.commit(); await db.refresh(asset)

    try:
        enqueue_image_job(job.id)
    except Exception as e:
        logger.warning("Cover job enqueue failed: %s", safe_error(e))
        job.status = JobStatus.FAILED
        job.error_message = "A feladat sorba állítása nem sikerült."
        asset.status = "failed"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not enqueue cover job (queue unavailable).",
        )
    return MediaAssetRead.model_validate(asset)


@router.get("/covers/styles", response_model=list[ImageStyleInfo])
async def list_cover_styles(_: str = Depends(get_current_user)) -> list[ImageStyleInfo]:
    return [
        ImageStyleInfo(slug=s.slug, label=s.label, entity_type=s.entity_type)
        for s in available_cover_styles()
    ]


@router.get("/covers/layouts", response_model=list[CoverLayoutInfo])
async def list_cover_layouts(_: str = Depends(get_current_user)) -> list[CoverLayoutInfo]:
    return [CoverLayoutInfo(slug=l.slug, label=l.label) for l in available_cover_layouts()]
```

Add the missing import `from app.schemas.media_asset import MediaAssetRead` at the top (grouped with the other `app.schemas` import).

- [ ] **Step 5: Mount the router**

In `apps/ai/app/main.py` (where `images.router` is included), add:

```python
from app.api.v1 import covers
app.include_router(covers.router, prefix="/api/v1")
```

(Match the exact include style/prefix used for the images router in that file.)

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_covers_endpoints.py`
Expected: PASS. Then `uv run --directory apps/ai ruff check app/api/v1/covers.py app/schemas/cover.py`.

- [ ] **Step 7: Regenerate shared types + commit** (controller)

Run: `bash scripts/gen-shared-types.sh` (the AI OpenAPI now includes `/ai/covers*`).

```bash
git add apps/ai/app/schemas/cover.py apps/ai/app/api/v1/covers.py apps/ai/app/main.py apps/ai/tests/integration/test_covers_endpoints.py packages/shared
git commit -m "feat(covers): POST /ai/covers + styles/layouts endpoints + regen shared-types"
```

---

## Task 7: Frontend covers API + hooks

**Files:**
- Create: `apps/web/lib/api/covers.ts`
- Create: `apps/web/lib/api/cover-hooks.ts`
- Modify: `apps/web/lib/api/image-types.ts` (add `coverLayoutInfoSchema`)
- Modify: `apps/web/test/msw/handlers.ts` + `fixtures.ts`
- Test: `apps/web/lib/api/__tests__/covers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/api/__tests__/covers.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { generateCover, listCoverLayouts, listCoverStyles } from "@/lib/api/covers";
import { resetImageStore } from "@/test/msw/handlers";

const aiBase = `${AI_BASE_URL}/api/v1`;

describe("lib/api/covers", () => {
  beforeEach(() => resetImageStore());

  it("generateCover POSTs the cover body and returns the generating asset", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${aiBase}/ai/covers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: "cover-1", project_id: "p", entity_type: "cover", entity_id: "book-1",
            status: "generating", mime: "image/png", width: null, height: null,
            model_name: "gemini/x", style: "cover_fantasy", is_canonical: false,
            created_at: "2026-06-22T00:00:00Z" },
          { status: 202 },
        );
      }),
    );
    const asset = await generateCover({
      bookId: "book-1", artStyle: "cover_fantasy", layout: "classic_centered",
      title: "Fárosz", author: "Rácz D.",
    });
    expect(asset.entity_type).toBe("cover");
    expect(body).toMatchObject({
      book_id: "book-1", art_style: "cover_fantasy", layout: "classic_centered",
      title: "Fárosz", author: "Rácz D.",
    });
  });

  it("lists cover styles and layouts", async () => {
    const styles = await listCoverStyles();
    expect(styles.some((s) => s.slug === "cover_fantasy")).toBe(true);
    const layouts = await listCoverLayouts();
    expect(layouts.some((l) => l.slug === "classic_centered")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `corepack pnpm -C apps/web exec vitest run lib/api/__tests__/covers.test.ts`
Expected: FAIL — `@/lib/api/covers` does not exist.

- [ ] **Step 3: Add the layout schema**

In `apps/web/lib/api/image-types.ts`:

```ts
export const coverLayoutInfoSchema = z.object({ slug: z.string(), label: z.string() });
export type CoverLayoutInfo = z.infer<typeof coverLayoutInfoSchema>;
```

- [ ] **Step 4: Implement `covers.ts`**

Create `apps/web/lib/api/covers.ts`:

```ts
/** Typed endpoint functions for the cover-generation endpoints (Phase 2). On the
 *  AI service base. A cover is a MediaAsset(entity_type="cover"); list/canonical/
 *  delete/media reuse `images.ts`. */
import { z } from "zod";
import { AI_BASE_URL, apiFetch } from "./client";
import {
  coverLayoutInfoSchema,
  imageStyleInfoSchema,
  mediaAssetReadSchema,
  type CoverLayoutInfo,
  type ImageStyleInfo,
  type MediaAssetRead,
} from "./image-types";

export interface GenerateCoverInput {
  bookId: string;
  artStyle: string;
  layout: string;
  title?: string | null;
  author?: string | null;
  subtitle?: string | null;
  model?: string | null;
}

export async function generateCover(input: GenerateCoverInput): Promise<MediaAssetRead> {
  const data = await apiFetch<unknown>("/ai/covers", {
    method: "POST",
    body: {
      book_id: input.bookId,
      art_style: input.artStyle,
      layout: input.layout,
      title: input.title ?? null,
      author: input.author ?? null,
      subtitle: input.subtitle ?? null,
      model: input.model ?? null,
    },
    baseUrl: AI_BASE_URL,
  });
  return mediaAssetReadSchema.parse(data);
}

export async function listCoverStyles(): Promise<ImageStyleInfo[]> {
  const data = await apiFetch<unknown>("/ai/covers/styles", { baseUrl: AI_BASE_URL });
  return z.array(imageStyleInfoSchema).parse(data);
}

export async function listCoverLayouts(): Promise<CoverLayoutInfo[]> {
  const data = await apiFetch<unknown>("/ai/covers/layouts", { baseUrl: AI_BASE_URL });
  return z.array(coverLayoutInfoSchema).parse(data);
}
```

- [ ] **Step 5: Implement `cover-hooks.ts`**

Create `apps/web/lib/api/cover-hooks.ts`:

```ts
"use client";
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { generateCover, listCoverLayouts, listCoverStyles, type GenerateCoverInput } from "./covers";
import { imageKeys } from "./image-hooks";
import type { CoverLayoutInfo, ImageStyleInfo, MediaAssetRead } from "./image-types";

export function useCoverStyles(): UseQueryResult<ImageStyleInfo[], Error> {
  return useQuery({ queryKey: ["cover-styles"], queryFn: listCoverStyles, staleTime: 5 * 60_000 });
}

export function useCoverLayouts(): UseQueryResult<CoverLayoutInfo[], Error> {
  return useQuery({ queryKey: ["cover-layouts"], queryFn: listCoverLayouts, staleTime: 5 * 60_000 });
}

export function useGenerateCover(): UseMutationResult<MediaAssetRead, Error, GenerateCoverInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateCoverInput) => generateCover(input),
    onSuccess: (asset) => {
      void qc.invalidateQueries({ queryKey: imageKeys.entity("cover", asset.entity_id ?? "") });
    },
  });
}
```

- [ ] **Step 6: Add MSW handlers + fixtures**

In `apps/web/test/msw/fixtures.ts` add `COVER_STYLES_FIXTURE` (ImageStyleInfo[] with `entity_type:"cover"`, slugs `cover_literary/cover_fantasy/cover_minimal`) and `COVER_LAYOUTS_FIXTURE` (`[{slug:"classic_centered",label:"Klasszikus"},{slug:"bottom_scrim",label:"Alsó sáv"},{slug:"top_minimal",label:"Felül"}]`).

In `apps/web/test/msw/handlers.ts`, alongside the `/ai/images*` handlers add:

```ts
  http.get(`${aiBase}/ai/covers/styles`, () => HttpResponse.json(COVER_STYLES_FIXTURE)),
  http.get(`${aiBase}/ai/covers/layouts`, () => HttpResponse.json(COVER_LAYOUTS_FIXTURE)),
  http.post(`${aiBase}/ai/covers`, async ({ request }) => {
    const b = (await request.json()) as { art_style: string };
    const asset = makeMediaAsset("generating", {
      entity_type: "cover", entity_id: "book-1", style: b.art_style,
    });
    imageStore.add(asset);
    return HttpResponse.json(asset, { status: 202 });
  }),
```

- [ ] **Step 7: Run + verify**

Run: `corepack pnpm -C apps/web exec vitest run lib/api/__tests__/covers.test.ts`
Expected: PASS. Then `corepack pnpm -C apps/web type-check` (clean).

- [ ] **Step 8: Commit** (controller)

```bash
git add apps/web/lib/api/covers.ts apps/web/lib/api/cover-hooks.ts apps/web/lib/api/image-types.ts apps/web/test/msw apps/web/lib/api/__tests__/covers.test.ts
git commit -m "feat(covers): FE covers API + hooks + MSW"
```

---

## Task 8: Cover panel component

**Files:**
- Create: `apps/web/components/book/cover-panel.tsx`
- Modify: `apps/web/lib/i18n/hu.ts` (`covers` block)
- Test: `apps/web/components/book/__tests__/cover-panel.test.tsx`

- [ ] **Step 1: Add the i18n block**

In `apps/web/lib/i18n/hu.ts` add a `covers` block:

```ts
  covers: {
    title: "Borító",
    artStyleLabel: "Stílus",
    layoutLabel: "Elrendezés",
    titleLabel: "Cím",
    authorLabel: "Szerző",
    subtitleLabel: "Alcím (opcionális)",
    generate: "Borító generálása",
    generating: "Generálás…",
    empty: "Még nincs borító ehhez a könyvhöz.",
    emptyHint: "Válassz stílust és elrendezést, majd generálj egyet.",
    generateFirst: "Első borító generálása",
    loadError: "A borítók betöltése nem sikerült.",
    loading: "Borítók betöltése",
    failedChip: "Sikertelen",
    retry: "Újragenerálás",
    generatingCaption: "Generálás folyamatban",
    canonicalBadge: "Kiválasztott",
    setCanonical: "Beállítás borítóként",
    delete: "Törlés",
    deleteTitle: "Borító törlése",
    deleteDescription: "Biztosan törlöd ezt a borítót? A művelet nem vonható vissza.",
    deletedToast: "A borító törölve.",
    canonicalToast: "A borító beállítva.",
    generateError: "A borító generálása nem sikerült.",
    heroAlt: (title: string) => `${title} borítója`,
  },
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/components/book/__tests__/cover-panel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { resetImageStore } from "@/test/msw/handlers";
import { CoverPanel } from "@/components/book/cover-panel";
import { hu } from "@/lib/i18n/hu";

const aiBase = `${AI_BASE_URL}/api/v1`;
const BOOK = { id: "book-1", title: "Fárosz", author: "Rácz D." };

describe("CoverPanel", () => {
  beforeEach(() => resetImageStore());

  it("renders style + layout pickers and posts a cover generation", async () => {
    const user = userEvent.setup();
    const posted: Record<string, unknown>[] = [];
    server.use(
      http.post(`${aiBase}/ai/covers`, async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { id: "c1", project_id: "p", entity_type: "cover", entity_id: "book-1",
            status: "generating", mime: "image/png", width: null, height: null,
            model_name: "x", style: "cover_fantasy", is_canonical: false,
            created_at: "2026-06-22T00:00:00Z" }, { status: 202 });
      }),
    );
    renderWithProviders(<CoverPanel bookId={BOOK.id} bookTitle={BOOK.title} bookAuthor={BOOK.author} />);
    await screen.findByLabelText(hu.covers.artStyleLabel);
    await screen.findByLabelText(hu.covers.layoutLabel);
    await user.click(await screen.findByRole("button", { name: hu.covers.generate }));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(posted[0]).toMatchObject({ book_id: "book-1", art_style: expect.any(String), layout: expect.any(String) });
  });

  it("shows the empty state when no covers exist", async () => {
    renderWithProviders(<CoverPanel bookId={BOOK.id} bookTitle={BOOK.title} bookAuthor={BOOK.author} />);
    expect(await screen.findByText(hu.covers.empty)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `corepack pnpm -C apps/web exec vitest run components/book/__tests__/cover-panel.test.tsx`
Expected: FAIL — `@/components/book/cover-panel` does not exist.

- [ ] **Step 4: Implement the panel**

Create `apps/web/components/book/cover-panel.tsx`. Model it closely on `apps/web/components/codex/image-panel.tsx` (the polished version: `MediaThumb`, `useMediaObjectUrl`, canonical ring, hover overlay actions, skeleton-shimmer generating tile, retry on failed). Differences: two pickers (art style from `useCoverStyles`, layout from `useCoverLayouts`); title (prefilled `bookTitle`), author (prefilled `bookAuthor`), optional subtitle inputs; `useGenerateCover`; list via `useEntityImages("cover", bookId)`; the canonical cover rendered as a larger hero preview above the gallery. Props:

```tsx
export interface CoverPanelProps {
  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
}
```

The Generate handler:

```tsx
function handleGenerate() {
  if (!artStyle || !layout) return;
  generate.mutate(
    { bookId, artStyle, layout, title, author, subtitle: subtitle || null },
    { onError: (e) => toast.error(`${hu.covers.generateError}: ${e.message}`) },
  );
}
```

Reuse `useSetCanonical` / `useDeleteImage` exactly as the image panel does (they are entity-type agnostic). Keep all copy in `hu.covers`.

- [ ] **Step 5: Run the test to confirm it passes**

Run: `corepack pnpm -C apps/web exec vitest run components/book/__tests__/cover-panel.test.tsx`
Expected: PASS. Then `corepack pnpm -C apps/web type-check` + `corepack pnpm -C apps/web lint` (clean).

- [ ] **Step 6: Commit** (controller)

```bash
git add apps/web/components/book apps/web/lib/i18n/hu.ts
git commit -m "feat(covers): cover panel component + hu copy"
```

---

## Task 9: Mount the cover panel in the book settings page

**Files:**
- Modify: `apps/web/app/(app)/konyv/[bookId]/beallitasok/page.tsx`
- Test: `apps/web/app/(app)/konyv/[bookId]/beallitasok/__tests__/page.test.tsx` (extend)

- [ ] **Step 1: Write the failing test** — the settings page shows the cover section.

```tsx
it("shows the cover generator section", async () => {
  renderSettings();
  expect(await screen.findByText(hu.covers.title)).toBeInTheDocument();
  expect(await screen.findByLabelText(hu.covers.artStyleLabel)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `corepack pnpm -C apps/web exec vitest run "app/(app)/konyv/[bookId]/beallitasok"`
Expected: FAIL — no cover section.

- [ ] **Step 3: Mount the panel**

In `…/beallitasok/page.tsx`, import and render `CoverPanel` in its own section (below the metadata form), passing the loaded book:

```tsx
import { CoverPanel } from "@/components/book/cover-panel";
// …inside the page, where `book` is available:
<CoverPanel bookId={book.id} bookTitle={book.title} bookAuthor={book.author} />
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `corepack pnpm -C apps/web exec vitest run "app/(app)/konyv/[bookId]/beallitasok"`
Expected: PASS. (The MSW `/ai/covers/styles` + `/ai/covers/layouts` handlers from Task 7 cover the picker fetches.)

- [ ] **Step 5: Commit** (controller)

```bash
git add "apps/web/app/(app)/konyv/[bookId]/beallitasok"
git commit -m "feat(covers): mount cover generator in book settings"
```

---

## Task 10: Full sanity + cross-resource integration + validation round

**Files:**
- Test: `apps/ai/tests/integration/test_cover_flow.py` (new, cross-resource)
- (No production code unless a gap is found.)

- [ ] **Step 1: Write a cross-resource flow test** — generate → list → canonical → serve (provider mocked).

Create `apps/ai/tests/integration/test_cover_flow.py`:

```python
@pytest.mark.integration
async def test_cover_end_to_end(client, auth_headers, db_session, monkeypatch, tmp_path):
    """POST /ai/covers → run the job inline (mocked provider) → the cover appears
    in GET /ai/images?entity_type=cover, can be made canonical, and /ai/media
    streams its bytes."""
    from alexandria_core.core.config import settings
    monkeypatch.setattr(settings, "media_dir", str(tmp_path))

    captured = {}
    import app.api.v1.covers as covers_mod
    monkeypatch.setattr(covers_mod, "enqueue_image_job", lambda jid: captured.setdefault("job", jid))

    async def fake_generate_image(prompt, *, model, db, reference_images=None, aspect_ratio="2:3", **kw):
        import io
        from PIL import Image
        from app.services.model_router import ImageResult
        buf = io.BytesIO(); Image.new("RGB", (1024, 1536), (12, 34, 56)).save(buf, "PNG")
        return ImageResult(data=buf.getvalue(), mime="image/png", model=model)
    monkeypatch.setattr("app.services.image_service.image_service.router", "generate_image", fake_generate_image, raising=False)

    await _make_provider_with_image_model(db_session, "gemini/x")
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id, title="Fárosz", author="Rácz D.")

    resp = await client.post("/api/v1/ai/covers", headers=auth_headers, json={
        "book_id": str(book_id), "art_style": "cover_fantasy", "layout": "classic_centered"})
    assert resp.status_code == 202

    # Run the enqueued job inline against the test session.
    from app.jobs.image_job import _run_image_job
    await _run_image_job(captured["job"], session_factory=_single_session_factory(db_session))

    listed = await client.get(
        f"/api/v1/ai/images?entity_type=cover&entity_id={book_id}", headers=auth_headers)
    assert listed.status_code == 200
    covers = listed.json()
    assert len(covers) == 1 and covers[0]["status"] == "ready"
    cover_id = covers[0]["id"]

    canon = await client.post(f"/api/v1/ai/images/{cover_id}/canonical", headers=auth_headers)
    assert canon.status_code == 200 and canon.json()["is_canonical"] is True

    media = await client.get(f"/api/v1/ai/media/{cover_id}", headers=auth_headers)
    assert media.status_code == 200 and media.headers["content-type"].startswith("image/")
```

(Use the same `_single_session_factory` helper the Phase-1 image-job tests use to drive the job against the test DB session. If `generate_image` monkeypatching by string path is awkward, inject a mocked `ImageService` into `_run_image_job(images=...)` instead — mirror whatever the Phase-1 job test does.)

- [ ] **Step 2: Run the new flow test**

Run: `uv run --directory apps/ai pytest -q -p no:cacheprovider tests/integration/test_cover_flow.py`
Expected: PASS.

- [ ] **Step 3: Full backend suites + lint**

Run:
```bash
uv run --directory apps/ai pytest -q -p no:cacheprovider
uv run --directory apps/ai ruff check
uv run --directory apps/api pytest -q -p no:cacheprovider
uv run --directory apps/api ruff check
```
Expected: all green (Phase-1 + new). Investigate any regression before proceeding.

- [ ] **Step 4: Full frontend suite + tsc + lint + shared-types freshness**

Run:
```bash
corepack pnpm -C apps/web type-check
corepack pnpm -C apps/web lint
corepack pnpm -C apps/web exec vitest run
bash scripts/gen-shared-types.sh && git diff --exit-code packages/shared
```
Expected: all green; `git diff --exit-code` clean (shared-types already committed in Tasks 2 + 6).

- [ ] **Step 5: Validation round (no silent errors)**

Review the diff for: empty `except`/swallowed errors (the cover service + job must be LOUD / sanitized like Phase 1); 422 validations raised OUTSIDE the `try` in `covers.py`; the `/ai/media` token never in a URL; font-missing and unknown-layout/style failing loudly; no hardcoded model ids (model resolves via `_resolve_image_model`); no secret reaching a log. Fix any gap found, re-run the affected suite.

- [ ] **Step 6: Commit** (controller)

```bash
git add apps/ai/tests/integration/test_cover_flow.py
git commit -m "test(covers): cross-resource cover flow (generate→list→canonical→serve) + sanity"
```

---

## Self-Review (against the spec)

**1. Spec coverage**

| Spec item | Task |
| --- | --- |
| `Book.author` field + migration + schema (decision A) | T1 |
| FE author field (decision A) | T2, T9 |
| Two-axis templates: art-style presets (decision B) | T3 |
| Two-axis templates: typography layouts (decision B) | T4 |
| Pillow compositor + bundled OFL fonts (no Playwright) | T4 |
| Exact 1600×2560 ebook front cover (decision C) | T4 (assert dims), T5 |
| Server-side composite + regenerate (decision D) | T5 (job branch), T8 (regenerate UI) |
| `MediaAsset(entity_type="cover")`, no new columns | T5, T6 |
| Cover inputs ride in `GenerationJob.input_data` | T5, T6 |
| `build_cover_prompt` (no-text instruction + fallbacks) | T3 |
| `POST /ai/covers` + styles/layouts; reuse list/canonical/delete/media | T6 (+ T10 reuse proof) |
| FE covers API/hooks reusing Phase-1 hooks | T7 |
| Cover panel (pickers, gallery, canonical hero, retry) | T8 |
| Mounted in `…/beallitasok` | T9 |
| `hu.covers` i18n | T8 |
| shared-types freshness gate | T2, T6, T10 |
| Tests: prompt, compositor, registries, endpoint validation, job branch, Book.author, FE panel/api, cross-resource | T1–T10 |
| Error handling: 422 outside try, sanitized 502, loud job failures | T5, T6, T10 |
| Out of scope (print wrap, export-embed, DB templates, live preview, re-typeset) | excluded — no task |

No gaps.

**2. Placeholder scan:** Concrete code/commands in every step. The only deliberately-symbolic tokens are the Alembic `<rev>` / `<current_head>` (resolved by `alembic heads` in T1 Step 4) — these are generated identifiers, not omitted content.

**3. Type/name consistency:** `build_cover_prompt(book, art_style)`, `available_cover_styles()`, `COVER_STYLES` (T3) ↔ used in T5/T6. `compose_cover(background_png, *, layout, title, author, subtitle)`, `available_cover_layouts()`, `LAYOUTS`, `COVER_W/COVER_H`, `_cover_crop` (T4) ↔ used in T5 + T4 tests. `generate_cover_for_book(...)` kwargs (T5) ↔ called identically in the job branch (T5) and asserted (T5 tests). `CoverGenerateRequest{book_id,art_style,layout,title,author,subtitle,model}` (T6) ↔ FE `generateCover` snake_case body (T7) ↔ MSW + panel POST (T7/T8). `input_data` cover keys (`entity_type,entity_id,art_style,layout,title,author,subtitle,model`) match between the endpoint (T6), the job's required-keys/branch (T5), and the flow test (T10). `coverLayoutInfoSchema` (T7) ↔ `CoverLayoutInfo` (T6). Consistent.
