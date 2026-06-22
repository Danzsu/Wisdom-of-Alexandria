# Book Cover Generator (Phase 2) — Design

**Status:** Approved (design) — 2026-06-22
**Author:** Phase-2 of the AI image feature (follows Phase-1 character/location image generation)
**Goal:** Generate a book's ebook **front cover** — AI-generated background art (Nano Banana Pro via the existing Google AI Studio provider) with **app-side composite typography** (title / author / optional subtitle) — reusing the Phase-1 image infrastructure.

---

## 1. Context & constraints

Phase 1 shipped character/location image generation. A cover is modelled as a
`MediaAsset(entity_type="cover", entity_id=book_id)`, so the bulk of Phase 1
reuses directly:

- `MediaAsset` (already has `entity_type`, `entity_id`, `status`, `file_path`,
  `thumb_path`, `mime`, `width`, `height`, `model_name`, `style`, `prompt`,
  `error_message`, `is_canonical`, `job_id`).
- `ModelRouter.generate_image(prompt, *, model, db, reference_images,
  aspect_ratio, client_factory)` → `ImageResult(data, mime, model)`.
- `image_storage.save_image()` (Pillow; PNG + ≤512px thumbnail) and
  `delete_image_files()`.
- The RQ job machinery: `GenerationJob` (`JobType.IMAGE`, JSON `input_data` /
  `output_data`), `app/jobs/image_job.py`, `enqueue_image_job()`.
- `/ai/media/{id}` header-only binary streaming + the FE blob/object-URL hook,
  `useSetCanonical`, `useDeleteImage`, `useEntityImages`.

**Dependency reality (decides the typography approach):** Pillow is available
server-side; **Playwright/cairo/Pango are not**, and **no fonts are bundled**.
Therefore app-side typography = **Pillow `ImageDraw` + bundled TTF fonts**
(Literata + Inter, both SIL OFL).

**Gap:** there is **no `author` field** anywhere (Book/Project are author-less;
auth is single-user `.env`). Covers need author text → we add `Book.author`.

## 2. Decisions (confirmed)

| # | Decision | Choice |
| - | --- | --- |
| A | Author/title text source | **New `Book.author` field (+ migration)**, persistent; title from `book.title`; subtitle is an optional per-generation free-text input. |
| B | Template structure | **Two axes**: an **art-style** picker (background prompt preset, like Phase-1 styles) × a **typography-layout** picker (title/author placement + font). |
| C | Format scope | **Ebook front cover only**, portrait, exact **1600×2560** (1:1.6). |
| D | Text positioning | **Server-side composite**; to change layout/text the user **regenerates** (a fresh Gemini call + new asset). No live FE canvas preview. |

**Architecture choice (confirmed lean MVP):** regenerate-each-time. **No new
`MediaAsset` columns and no new table** — cover inputs (`art_style`, `layout`,
`title`, `author`, `subtitle`, `model`) ride in the existing
`GenerationJob.input_data` JSON; the art-style slug is stored in
`MediaAsset.style`; the composited PNG is the asset. (Deferred fast-follow:
persist the raw background + a free "re-typeset without re-calling Gemini"
endpoint.)

## 3. Components & files

### Data model
- `packages/db/alexandria_core/models/book.py` — add `author: Mapped[str | None]`
  (`String(255)`, nullable).
- `apps/api/alembic/versions/<rev>_add_book_author.py` — add `books.author`
  (dialect-agnostic `add_column` / `drop_column`).
- `apps/api/app/schemas/book.py` (or wherever Book schemas live) — `author` on
  `BookRead` / `BookCreate` / `BookUpdate` (optional, ≤255).
- FE: `apps/web/lib/api/types.ts` (`bookReadSchema` + create/update), the book
  settings form, and shared-types regen.

### Cover prompt
- `apps/ai/app/services/image_prompt.py` — add `build_cover_prompt(book, art_style)`:
  fills `{title}` / `{genre}` / `{synopsis}` / `{mood}` from the Book; the STYLE
  block **hard-instructs** "no text, lettering, logos, or watermark; leave clean
  negative space suitable for an overlaid title." Validates `art_style` belongs
  to `entity_type="cover"`. Graceful fallbacks for empty genre/synopsis.
- `packages/prompts/hu/cover_styles/*.md` — ~5 presets (`cover_literary`,
  `cover_fantasy`, `cover_thriller`, `cover_romance`, `cover_minimal`), same
  `STYLE --- body` format as Phase-1 styles, `entity_type="cover"`.

### Typography compositor (new)
- `apps/ai/app/services/cover_compositor.py` (Pillow). **Layouts** are typed
  config (not markdown): `classic_centered`, `bottom_scrim`, `top_minimal`. Each
  layout declares title font (Literata serif) + author font (Inter), text anchor
  + margins as **fractions of the 1600×2560 canvas**, text colour, an optional
  legibility **gradient scrim**, max font size with **width-wrap + binary-search
  autofit**.
- `apps/ai/fonts/` — bundled `Literata-*.ttf` + `Inter-*.ttf` (SIL OFL) + a
  `NOTICE`/license file. Compositor resolves fonts from this dir (Docker + local).
- `compose_cover(background_png: bytes, *, layout, title, author, subtitle) ->
  bytes`: decode → cover-crop/resize to exactly 1600×2560 → optional scrim →
  draw title (wrapped, autofit) → author → optional subtitle → return PNG bytes.

### Generation flow
- `apps/ai/app/services/image_service.py` — branch on `entity_type == "cover"`:
  load Book, `build_cover_prompt`, `generate_image(aspect_ratio="2:3")` (closest
  to 1:1.6; the compositor crops to exact dims), `compose_cover(...)`, then
  `save_image()` + persist the ready `MediaAsset`. Failure cleans up partial
  files and re-raises (job persists `failed`).
- `apps/ai/app/jobs/image_job.py` — the cover branch reads the extra cover keys
  from `input_data` (`layout`, `title`, `author`, `subtitle`).

### Endpoints
- `apps/ai/app/api/v1/covers.py` (new):
  - `POST /ai/covers` — body `{book_id, art_style, layout, title?, author?,
    subtitle?, model?}`. Validate **before create** (422, outside try): book
    exists, `art_style` ∈ cover styles, `layout` ∈ layouts. Default `title` =
    `book.title`, `author` = `book.author`. Create `generating`
    `MediaAsset(entity_type="cover", entity_id=book_id, style=art_style)` +
    `GenerationJob` with cover `input_data`; enqueue; sanitized 502 on enqueue
    failure (asset+job marked failed). 202 → `MediaAssetRead`.
  - `GET /ai/covers/styles` → `ImageStyleInfo[]` (cover art styles).
  - `GET /ai/covers/layouts` → `CoverLayoutInfo[]` (`{slug, label}`).
- **Reused unchanged:** `GET /ai/images?entity_type=cover&entity_id=<book>`,
  `POST /ai/images/{id}/canonical`, `DELETE /ai/images/{id}`, `GET /ai/media/{id}`.
- Schemas in `apps/ai/app/schemas/`: `CoverGenerateRequest`, `CoverLayoutInfo`
  (+ re-export the relevant types in `packages/shared`).

### Frontend
- `apps/web/lib/api/covers.ts` — `generateCover()`, `listCoverStyles()`,
  `listCoverLayouts()`; reuse `images.ts` for list/canonical/delete/`fetchMediaBlob`.
- `apps/web/lib/api/cover-hooks.ts` — `useGenerateCover`, `useCoverStyles`,
  `useCoverLayouts`; reuse `useEntityImages("cover", bookId)`, `useSetCanonical`,
  `useDeleteImage`, `useMediaObjectUrl`.
- `apps/web/components/book/cover-panel.tsx` — art-style picker × layout picker,
  title (prefilled from book), author (prefilled from `book.author`), optional
  subtitle, Generate button; gallery of covers (reuse the `MediaThumb`/object-URL
  pattern + canonical ring + hover actions from the Phase-1 polish); the canonical
  cover rendered as a larger "hero" preview.
- Mounted in `apps/web/app/(app)/konyv/[bookId]/beallitasok/page.tsx`. `author`
  field added to the book settings form.
- `apps/web/lib/i18n/hu.ts` — `covers` block.

## 4. Data flow & error handling

Mirrors Phase 1: validation 422s raised **outside** the try (never re-wrapped as
502); job state machine `pending→running→done/failed`; on failure the asset is
`failed` + `error_message` set (nothing dangles); bytes streamed header-only via
`/ai/media` (no token in URL). Compositor errors (missing font, undecodable
background) fail the job loudly with a sanitized message. Stray in-art text from
the model is mitigated by the negative prompt **and** the layout scrim.

## 5. Testing (FTDD)

**Backend (`apps/ai` / `apps/api`):**
- `build_cover_prompt`: placeholder fill from Book, the "no-text/negative-space"
  instruction present, fallbacks for empty genre/synopsis, art-style/entity_type
  validation.
- `cover_compositor.compose_cover`: output is exactly 1600×2560 PNG; title +
  author drawn (pixels differ vs. the bare background); long titles wrap and
  autofit; scrim applied for the scrim layout; missing font fails loudly.
- cover style + layout registries (`available styles(entity_type="cover")`,
  layouts list).
- `POST /ai/covers`: 422 (outside try) for missing book / bad style / bad layout
  **before** any asset is created; happy path creates a generating cover asset +
  job and enqueues; sanitized 502 on enqueue failure marks both failed.
- cover job branch: `entity_type=="cover"` runs the cover flow (mock
  `generate_image`, assert composite + ready asset + `output_data.media_asset_id`).
- `Book.author`: migration up/down; Book CRUD round-trips `author`.

**Frontend (`apps/web`):**
- cover panel renders style + layout pickers from the endpoints; Generate POSTs
  the correct body (book_id/art_style/layout/title/author/subtitle); gallery +
  set-canonical + delete; canonical hero preview; author field in the settings
  form persists.
- MSW handlers for `/ai/covers*`; shared-types freshness (OpenAPI regen committed).

## 6. Known risks & mitigations

- **Diffusion text leakage** in the art → strong negative prompt + layout scrim
  over typical text zones.
- **Font licensing** → Literata + Inter are SIL OFL; bundle the license/NOTICE.
- **Center-crop clipping** (2:3 generated → 1:1.6 target) → acceptable for MVP; a
  "fit" mode is a later option.
- **Nano Banana Pro 4K cost** → covers are infrequent; the model is overridable
  per request and defaults to the configured `provider.image_model`.
- **Pillow autofit complexity** → bounded binary-search font-size-to-width with a
  min/max clamp.

## 7. Out of scope (V2+)

Print full-wrap covers (spine/back/bleed/DPI); embedding the cover into
Markdown/DOCX/EPUB export; DB-backed user-editable templates; live FE canvas
preview; re-typeset-without-regenerate (store raw background + free recompose
endpoint); multiple covers across a series/universe.
