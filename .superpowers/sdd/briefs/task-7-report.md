# Task 7 Report — Frontend Covers API + Hooks + MSW

## Status: COMPLETE ✅

## Files Created
- `apps/web/lib/api/covers.ts` — `generateCover`, `listCoverStyles`, `listCoverLayouts` (camelCase→snake_case serialization, Zod validation, `AI_BASE_URL` base)
- `apps/web/lib/api/cover-hooks.ts` — `useGenerateCover`, `useCoverStyles`, `useCoverLayouts` (TanStack Query hooks; `useGenerateCover` invalidates `imageKeys.entity("cover", ...)` on success)
- `apps/web/lib/api/__tests__/covers.test.ts` — 2 tests: POST body mapping + return shape, styles/layouts list

## Files Modified
- `apps/web/lib/api/image-types.ts` — added `coverLayoutInfoSchema` + `CoverLayoutInfo` type
- `apps/web/test/msw/fixtures.ts` — added `COVER_STYLES_FIXTURE` (3 styles, entity_type "cover") and `COVER_LAYOUTS_FIXTURE` (3 layouts); imported `CoverLayoutInfo`
- `apps/web/test/msw/handlers.ts` — added `COVER_LAYOUTS_FIXTURE`/`COVER_STYLES_FIXTURE` imports; added 3 handlers: `GET /ai/covers/styles`, `GET /ai/covers/layouts`, `POST /ai/covers` (uses shared `imageStore.add` + `makeMediaAsset`)

## Commands & Results

```
corepack pnpm -C apps/web exec vitest run lib/api/__tests__/covers.test.ts
→ 2 passed (2) ✅

corepack pnpm -C apps/web type-check
→ clean (no output) ✅

corepack pnpm -C apps/web lint
→ No ESLint warnings or errors ✅

corepack pnpm -C apps/web exec vitest run
→ 118 test files, 681 tests passed (no regressions) ✅
```

## Design Decisions
- `coverLayoutInfoSchema` placed in `image-types.ts` (alongside `mediaAssetReadSchema` / `imageStyleInfoSchema`) as specified — no new file needed.
- No OpenAPI contract tie added for `CoverLayoutInfo` (the AI OpenAPI is regenerated in T10; the schema is pinned directly in Zod for now).
- `cover-hooks.ts` reuses `imageKeys` from `image-hooks.ts` for cache invalidation — exactly as the brief requires.
- The MSW POST handler uses the existing `imageStore` so `resetImageStore()` in test `beforeEach` also clears cover assets, keeping test isolation consistent with Phase 1.

## Concerns
None. All green.
