# Phase-2 Task 2 Report: State-pattern adoption — list screens

## Per-screen changes

### timeline-screen.tsx

- **Error:** Ad-hoc centered `<div>` with a danger `<p>`, detail `<p>`, and a `<Button variant="secondary">` retry — replaced with `<ErrorState message detail onRetry>`. `onRetry` calls `tree.refetch()` + `projectIdQuery.refetch()` (unchanged logic).
- **Loading:** `<Spinner size={14}>` + loading text in a centered flex row — replaced with `<SkeletonList rows={5}>` in a full-flex column.
- **Empty:** Ad-hoc centered `<div>` with `<BrandStar>` badge, two `<p>` tags, and a `<Button variant="cta">` with `<ArrowRight>` icon — replaced with `<EmptyState icon title description action>`. `action.onClick` still navigates to `routes.book(bookId, "terv")`.
- **Imports removed:** `ArrowRight`, `Spinner`, `Button` (was only used in the replaced blocks).

### relations-screen.tsx

- **Error:** Ad-hoc centered `<div>` with danger `<p>` and detail `<p>` — **had no retry** — replaced with `<ErrorState message detail onRetry>`. `onRetry` now calls `relationsQuery.refetch()` + `entriesQuery.refetch()` + `projectIdQuery.refetch()` (new retry wiring added).
- **Loading:** `<Spinner size={14}>` + loading text — replaced with `<SkeletonList rows={4}>`.
- **Empty:** Ad-hoc centered `<div>` with `<BrandStar>` badge, two `<p>` tags, and `<Button variant="cta">` — replaced with `<EmptyState icon title description action>`. `action.onClick` still calls `setModalOpen(true)`.
- **Imports removed:** `BrandStar` (still imported from kit/brand-star for icon prop), `Spinner`.

### plotlines-screen.tsx

- **Error:** Ad-hoc centered `<div>` with danger `<p>`, detail `<p>`, and `<Button variant="secondary">` retry — replaced with `<ErrorState message detail onRetry>`. `onRetry` logic preserved.
- **Loading:** `<Spinner size={14}>` + loading text — replaced with `<SkeletonList rows={4}>`.
- **Empty:** Ad-hoc centered `<div>` with `<BrandStar>` badge, two `<p>` tags, and `<Button variant="cta">` with `<Plus>` icon — replaced with `<EmptyState icon title description action>`. `action.onClick` still calls `openCreate()`.
- **Imports removed:** `Spinner`.

### jobs-screen.tsx

- **Error:** Ad-hoc centered `<div>` with danger `<p>` (title) + muted `<p>` (detail), no retry — replaced with `<ErrorState message detail onRetry>`. `onRetry` calls `jobs.refetch()` (new retry wiring added).
- **Loading:** Custom `JobsLoading()` sub-component (hand-rolled `Card`+`Skeleton` grid, `role="status"`) — deleted. Replaced with three `<SkeletonCard />` inside a `role="status"` wrapper using `hu.jobs.loadingAria`.
- **Empty:** Custom `JobsEmpty()` sub-component (hand-rolled `<Icon ListChecks>` badge + two `<p>` tags) — deleted. Replaced with `<EmptyState icon title description>` (no CTA: jobs screen has no create action).
- **Imports removed:** `Skeleton` (was used only by `JobsLoading`), `ListChecks` now used directly in `EmptyState` icon prop.

## CTA / retry wiring

| Screen | Empty CTA | Error retry |
| --- | --- | --- |
| timeline | `routes.book(bookId, "terv")` nav (preserved) | `tree.refetch()` + `projectIdQuery.refetch()` (preserved) |
| relations | `setModalOpen(true)` (preserved) | `relationsQuery.refetch()` + `entriesQuery.refetch()` + `projectIdQuery.refetch()` (new) |
| plotlines | `openCreate()` (preserved) | `plotlinesQuery.refetch()` + `projectIdQuery.refetch()` (preserved) |
| jobs | none | `jobs.refetch()` (new) |

## Test updates

All 4 test files updated to find the new patterns:

- **Empty branch:** `getByRole("heading", { name: ... })` (EmptyState renders `<h2>`) instead of `getByText(...)`.
- **Error branch:** `getByRole("alert")` (ErrorState has `role="alert"`) + `getByText(message)` + `getByRole("button", { name: hu.common.retry })` (ErrorState's retry label).
- **Relations error test:** Extended to also assert the retry button (was missing before — relations had no retry; now it does).
- **Jobs error test:** Extended to assert `role="alert"` + retry button.
- `hu` import added to `jobs-screen.test.tsx`.

## Test results

Focused (4 screens, 6 files): **42 passed**
Full suite: **749 passed (749)** — same count as before, no regressions.

## Type-check / lint

`tsc --noEmit`: clean (no output).
`eslint` on all 4 changed screens: clean (no output).

## Concerns

None. All SonarLint IDE warnings (`typescript:S3735` void-in-callback, `typescript:S6819` role="status") are pre-existing patterns used throughout the codebase and are not ESLint rules — they do not affect CI.

---

## FIX: Mutation-proof retry-click assertions (code-review gap closure)

A review identified that the 4 error-branch tests only asserted the retry button EXISTS but never clicked it and verified the refetch fired. This meant inverting `onRetry` to a no-op would not fail any test. The gap is now closed.

### Per-screen change

**timeline — `timeline-screen.test.tsx`**

- The existing `"surfaces an error with a retry button"` test was extended and renamed to `"surfaces an error with a retry button and clicking retry refetches and recovers"`.
- Pattern: override `/books/:bookId/chapters` to 500, wait for `role="alert"`, call `server.resetHandlers()` to restore the default success handler, click the retry button via `userEvent`, then `waitFor` the alert to disappear and `CHAPTER_ONE.title` to appear.
- Mutation-proof: if `onRetry` is a no-op, `tree.refetch()` never fires, the 500 handler stays active (MSW never re-fetches), the alert never disappears, and the chapter heading never appears — the `waitFor` assertions fail.

**relations — `relations-screen.test.tsx`**

- The existing `"surfaces an error state when the relations query fails"` test was extended and renamed to include `"and clicking retry refetches and recovers"`.
- Pattern: override `/projects/:projectId/codex-relations` to 500, wait for `role="alert"`, restore handlers, click retry, wait for alert disappears and `"Szelene"` node appears.
- Priority case: relations had no retry before Task 2; the new `onRetry` wiring (`relationsQuery.refetch()` + `entriesQuery.refetch()` + `projectIdQuery.refetch()`) is now mutation-proofed. A no-op `onRetry` leaves the alert up indefinitely and "Szelene" never renders.

**plotlines — `plotlines-screen.test.tsx`**

- The existing `"surfaces an error state with retry when the plotlines query fails"` test extended and renamed.
- Pattern: override `/projects/:projectId/plotlines` to 500, wait for alert, restore handlers, click retry, wait for alert disappears and `"A Fárosz fénye"` plotline card appears.
- Mutation-proof: a no-op `onRetry` leaves the 500 handler active for all future requests, the plotline list never refetches, the alert persists, and `"A Fárosz fénye"` never renders.

**jobs — `jobs-screen.test.tsx`**

- The existing `"shows an error state when the jobs fetch fails"` test extended and renamed.
- Pattern: override `${aiBase}/jobs` to 500, wait for alert, restore handlers, click retry, wait for alert disappears and `"Átírás"` job row appears.
- Priority case: jobs had no retry before Task 2; the new `onRetry` wiring (`jobs.refetch()`) is now mutation-proofed. A no-op leaves the alert up and no job rows ever load.
- Added `waitFor` to the `@testing-library/react` import (was missing).

### Test results after fix

Focused (6 files, 4 screens + 2 unit suites): **42 passed** (same count — 4 tests renamed/extended in place, not added anew).
Full suite: **749 passed (749)** — no regressions.

### Type-check and lint after fix

`tsc --noEmit`: clean.
`eslint` on all 4 test files: clean.
