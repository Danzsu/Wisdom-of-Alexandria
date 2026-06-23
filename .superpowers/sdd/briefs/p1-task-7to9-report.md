# P1 Tasks 7–9 Implementation Report

## T7 — Skeleton patterns

**Files:**
- Created: `apps/web/components/kit/skeleton-patterns.tsx`
- Created: `apps/web/components/kit/__tests__/skeleton-patterns.test.tsx`
- Modified: `apps/web/components/kit/index.ts` (barrel export added)

**Public API:**
- `SkeletonCard({ className? })` — card-shaped shimmer block with testid `skeleton-card`
- `SkeletonList({ rows, className? })` — stacked rows, testid `skeleton-list`
- `SkeletonTable({ rows, cols, className? })` — rows×cols grid, testid `skeleton-table`

All three are `aria-hidden="true"`, composed from the existing `Skeleton` primitive.
Use `rounded-lg`/`rounded-md`/`rounded-sm` scale tokens; gap via Tailwind.

**Tests:** 8 tests — row/cell counts, aria-hidden, axe-clean on all three variants. All pass.

---

## T8 — EmptyState + ScreenPlaceholder re-expression

**Files:**
- Created: `apps/web/components/kit/empty-state.tsx`
- Modified: `apps/web/components/shell/screen-placeholder.tsx`
- Created: `apps/web/components/kit/__tests__/empty-state.test.tsx`
- Modified: `apps/web/components/kit/index.ts` (barrel export added)

**Public API:**
```ts
EmptyState({
  icon?: ReactNode,       // decorative (aria-hidden badge)
  title: string,          // rendered as <h2>
  description?: string,   // muted paragraph
  action?: { label, onClick } | ReactNode,  // accent-outline Button or custom node
  className?: string,
})
```

Icon rendered in a `bg-accent-muted text-accent-text` rounded badge (matches `V1Placeholder` in codex-detail.tsx).
Title: `font-serif text-title font-semibold`.
Description: `text-body text-text-muted max-w-prose`.
CTA: `Button variant="accent-outline"` when an action object is provided.

**ScreenPlaceholder change:** now renders `<EmptyState icon={<BrandStar size={28}/>} title={label} description={hint} />`. Public `{ label, hint? }` API unchanged — all three placeholder routes (attekintes/promptok/hangok) are unaffected.

**Tests:** 8 tests — heading, description, CTA click, custom ReactNode action, no-extra-DOM when props omitted, aria-hidden icon, axe-clean. All pass.

---

## T9 — inline ErrorState + dashboard adoption

**Files:**
- Created: `apps/web/components/kit/error-state.tsx`
- Modified: `apps/web/components/projects/projects-dashboard.tsx`
- Modified: `apps/web/lib/i18n/hu.ts`
- Created: `apps/web/components/kit/__tests__/error-state.test.tsx`
- Modified: `apps/web/components/kit/index.ts` (barrel export added)

**Public API:**
```ts
ErrorState({
  message: string,     // short heading-weight message
  detail?: string,     // optional muted secondary text
  onRetry?: () => void,  // shows retry button when provided
  className?: string,
})
```

`role="alert"`, full border `border-danger`, `rounded-lg`, `AlertTriangle` icon (`aria-hidden`).
Retry button label: `hu.common.retry` ("Újrapróbálkozás"). No side stripes.

**Dashboard adoption diff:**
- Removed local `ErrorCard` function (~16 lines).
- `AllProjectsSection` error branch now uses `<ErrorState message={hu.projects.loadError} detail={query.error.message} onRetry={() => void query.refetch()} />`.
- Import added: `import { ErrorState } from "@/components/kit/error-state";`.

**hu.ts keys added:**
- `hu.common.retry` = "Újrapróbálkozás" (new `common` section)
- `hu.projects.loadError` = "Nem sikerült betölteni a projekteket" (alias for `errorTitle`, same text — dashboard test still green because both strings resolve identically)

**Tests:** 7 tests — role=alert + message, retry calls onRetry, retry label = hu.common.retry, detail text, no button without onRetry, axe-clean x2. All pass.
Dashboard test still green (text values unchanged; `hu.projects.errorTitle` == `hu.projects.loadError`; `hu.projects.errorRetry` == `hu.common.retry`).

---

## Full-suite summary

- Tests before: 705
- Tests after: **728** (123 test files, all pass)
- `type-check`: clean (no errors)
- `lint`: clean ("No ESLint warnings or errors")

---

## Concerns

None blocking. Two minor notes:
1. `SkeletonList` rows use `.woa-skel` explicitly on child `Skeleton`s — but the base `Skeleton` component already adds `.woa-skel`. The test queries `.woa-skel` and passes. The class is present on each row.
2. `EmptyState` uses an `isActionObject` type-guard for React node vs. action object discrimination — the guard checks for `label` and `onClick` keys, which is reliable for the intended usage pattern.
