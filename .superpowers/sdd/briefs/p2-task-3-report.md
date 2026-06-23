# P2 Task 3 Report — State-pattern adoption: board, research, codex

## Status: DONE

---

## Changed files

| File | Change |
|---|---|
| `apps/web/components/plan/use-plan-board.ts` | Added `refetch: () => void` to `PlanBoardController` interface + wired `tree.refetch` in return value |
| `apps/web/components/plan/plan-board.tsx` | Loading → `SkeletonCard` grid (6 cards, aria-label); Error → `ErrorState(message, detail, onRetry=controller.refetch)`; EmptyBook → `EmptyState(icon, title, description, action={label,onClick})`. Removed `Spinner`, `Plus`, `Icon` imports (unused). |
| `apps/web/components/research/research-screen.tsx` | Error block `<p role="status">` → `ErrorState(message, onRetry=researchMutation.reset)`; empty block → `EmptyState(icon, title, description)`. |
| `apps/web/components/shell/codex-sidebar.tsx` | Loading `<Spinner>` block → `SkeletonList(rows=5)`; error `<p role="alert">` → `ErrorState(message, detail, onRetry=codex.refetch)`; empty-book block → `EmptyState(icon, title, description, action={label,onClick})`. Removed `Spinner` import. |
| `apps/web/components/codex/codex-detail.tsx` | `MentionsTab`: loading `<Spinner>` → `SkeletonList(rows=4)`; error `<p role="alert">` → `ErrorState(message, detail, onRetry=tree.refetch)`; empty → `EmptyState(title)`. Added `EmptyState, ErrorState, SkeletonList` imports. `Spinner` kept (still used in header save indicator). |
| `apps/web/components/plan/__tests__/plan-board.test.tsx` | Renamed error test; added `retry button refetches and clears the error` (MSW fail → reset → click retry → success content); added `loading state renders SkeletonCard` test. |
| `apps/web/components/research/__tests__/research-screen.test.tsx` | Renamed error test (assert `role="alert"`); added `retry resets mutation` test (MSW fail → reset → click retry → alert gone, input still accessible). |
| `apps/web/components/codex/__tests__/codex-sidebar.test.tsx` | Updated empty-state test to assert `role="heading"`; updated error test; added `retry refetches and shows entries` test (MSW fail → reset → click retry → Szelene appears, alert gone). |
| `apps/web/components/codex/__tests__/codex-detail.test.tsx` | Added `MentionsTab resolves SkeletonList and shows mention entries`; added `MentionsTab ErrorState retry refetches` mutation-proof test (MSW fail → reset → click retry → alert gone, mention text appears). |
| `apps/web/components/plan/__tests__/plan-grid-dnd.test.tsx` | Added `refetch: vi.fn()` to `makeController()` mock to satisfy the updated `PlanBoardController` interface. |

---

## Per-surface summary

### plan-board
- Replaced: inline `<Spinner>` loading → `SkeletonCard` grid; ad-hoc error `<div>` → `ErrorState`; `EmptyBook` hand-rolled markup → `EmptyState`
- CTA wiring: `EmptyState action.onClick = controller.createFirstChapter` (unchanged behavior)
- Retry wiring: `onRetry = controller.refetch` (newly exposed from `use-plan-board.ts` via `tree.refetch`)
- Mutation-proof retry test: MSW returns 500 → error renders → `server.resetHandlers()` → click "Újrapróbálkozás" → `CHAPTER_ONE.title` appears, `role="alert"` gone

### research-screen
- Replaced: `<p role="status">` error → `ErrorState`; dashed-border empty div → `EmptyState`
- Retry wiring: `onRetry = researchMutation.reset` (clears error so a new question can be asked)
- Mutation-proof retry test: MSW 502 → error renders → `server.resetHandlers()` → click retry → alert gone, input still accessible

### codex-sidebar
- Replaced: `<Spinner>` loading → `SkeletonList(rows=5)`; `<p role="alert">` error → `ErrorState`; hand-rolled empty block → `EmptyState`
- CTA wiring: `EmptyState action.onClick = () => setModalOpen(true)` (unchanged)
- Retry wiring: `onRetry = () => { codex.refetch(); }`
- Mutation-proof retry test: MSW 500 → alert renders → `server.resetHandlers()` → click retry → Szelene appears, alert gone

### codex-detail (MentionsTab)
- Replaced: `<Spinner>` loading → `SkeletonList(rows=4)`; `<p role="alert">` error → `ErrorState`; `<p>` empty → `EmptyState`
- Retry wiring: `onRetry = tree.refetch`
- V1Placeholder tabs untouched (intentional deferred-feature cards)
- Mutation-proof retry test: MSW chapters 500 → switch to Megemlítések tab → alert renders → `server.resetHandlers()` → click retry → alert gone, mention snippet appears

---

## Test counts

- Targeted suite (`components/plan components/research components/codex`): **73 passed**
- Full suite: **755 passed** (was 749 — +6 new tests)

---

## tsc / lint

- `tsc --noEmit`: **clean**
- `eslint components/plan components/research components/codex components/shell/codex-sidebar.tsx`: **clean** (0 errors, 0 warnings in touched files)
- Full `eslint . --max-warnings 0` has 3 pre-existing errors in `next-env.d.ts` (auto-generated, triple-slash) and `test/a11y-matchers.d.ts` (empty interface) — none introduced by this task

---

## Concerns

None. All kit primitives (`EmptyState`, `ErrorState`, `SkeletonCard`, `SkeletonList`) adopted cleanly. No `border-l/-r` accent stripes, no gradient text, no em dashes introduced. All copy reuses existing `hu.ts` keys. `Spinner` kept only for the inline save indicator in `CodexDetail` header (correct per rules).
