# Tasks 2–5 Implementation Report

## T2 — ProgressBar accessible name

**Files changed:**
- `apps/web/components/kit/progress-bar.tsx` — destructure `"aria-label": ariaLabel` from props; add `aria-label={ariaLabel ?? "Folyamatjelző"}` and `aria-valuetext={indeterminate ? undefined : \`${Math.round(pct)}%\`}` to the `role="progressbar"` div.
- `apps/web/components/kit/__tests__/progress-bar.test.tsx` — extended with 4 new tests in a dedicated `"ProgressBar — accessibility (T2)"` describe block (accessible name from `aria-label`; default name when none given; no `aria-valuetext` when indeterminate; axe-clean).

**Before:** `role="progressbar"` had no accessible name (axe `aria-progressbar-name` violation), no `aria-valuetext`.
**After:** Named via `aria-label` prop or falls back to `"Folyamatjelző"`; `aria-valuetext` set for determinate mode; axe-clean.

---

## T3 — StatusDot role=img when labelled

**Files changed:**
- `apps/web/components/kit/status-dot.tsx` — computed `const a11y = ariaLabel ? { role: "img" as const, "aria-label": ariaLabel } : { "aria-hidden": true }` once; all four return branches now spread `{...a11y}` replacing the previous `aria-label`/`aria-hidden` pair.
- `apps/web/components/kit/__tests__/status-dot.test.tsx` — extended with 4 new tests in `"StatusDot — accessibility (T3)"` (labelled dot has `role=img`; unlabelled dot has `aria-hidden="true"`; labelled timeline treatment has `role=img`; unlabelled timeline is `aria-hidden`).

**Before:** `aria-label` on a role-less `<span>` was a prohibited attribute (axe `aria-prohibited-attr` on DiffPane). The label was not reachable by AT.
**After:** Labelled dots expose `role="img"` making `aria-label` valid; unlabelled dots remain `aria-hidden`.

---

## T4 — Tabs inside a tablist

**Grep result for bare `<Tab` usages (excluding TabBar):**
```
apps/web/app/(app)/konyv/[bookId]/beallitasok/page.tsx:25: — type alias named `Tab`, not the component (false positive)
apps/web/app/kitchen-sink/page.tsx:357,369,372,375 — Tab usages
apps/web/components/export/export-screen.tsx:35,38 — already inside TabBar ✓
apps/web/components/inspector/inspector-tab-bar.tsx:44 — already inside TabBar ✓
```

The only real offenders were in `kitchen-sink/page.tsx`:
- Line 357: inside `<TabBar aria-label="részletek">` — already correct.
- Lines 369–377: three vertical `<Tab>` elements inside a bare `<div>` — **fixed**.

**Files changed:**
- `apps/web/app/kitchen-sink/page.tsx` — replaced the bare `<div className="flex w-48 gap-2 ...">` wrapping the vertical inspector specimen with `<TabBar aria-label="Inspektor panel" className="w-48 gap-2 ...">`.
- `apps/web/components/kit/__tests__/tab.test.tsx` — added top-level `assertTabsHaveTablistAncestor` helper and a `"Tab — tablist parent requirement (T4)"` describe block with two tests: one documenting that bare Tabs violate the requirement, one asserting the fix is structurally sound.

**No component code changed** — `TabBar` already provides `role="tablist"`.

---

## T5 — Localize transport error

**Files changed:**
- `apps/web/lib/api/client.ts` — in the `catch (cause)` block: added an AbortError guard (`if (cause instanceof DOMException && cause.name === "AbortError") throw cause`) before constructing the `ApiError`; replaced `cause.message` passthrough with the fixed Hungarian string `"Nem sikerült elérni a szervert. Ellenőrizd a kapcsolatot."` as the user-facing message; original `cause` kept as the `ApiError.body` for debugging.
- `apps/web/lib/api/__tests__/client.test.ts` — extended with `"apiFetch — transport errors (T5)"` describe block: (1) `TypeError("Failed to fetch")` mock → thrown message is the Hungarian string, status 0; (2) `DOMException("...", "AbortError")` mock → re-thrown as `DOMException`, not `ApiError`.

**Before:** Raw browser `"Failed to fetch"` was exposed to users.
**After:** All transport failures surface `"Nem sikerült elérni a szervert. Ellenőrizd a kapcsolatot."`; intentional aborts pass through unchanged.

---

## Full-suite results

- `corepack pnpm -C apps/web exec vitest run`: **120 test files, 705 tests — all passed**
- `corepack pnpm -C apps/web type-check`: **clean (no errors)**
- `corepack pnpm -C apps/web lint`: **clean (no ESLint warnings or errors)**

## Concerns

- The `status-dot.tsx` spread of `{ "aria-hidden": true }` (without `as const`) loses the literal type narrowing that React's `aria-hidden` prop expects (`true | undefined`, not `boolean`). TypeScript accepts it without error because React's `aria-hidden` type is `boolean | undefined`, so this is safe. The previous `true as const` was flagged as an unnecessary assertion by the IDE (S4325).
- The T4 test for the "broken pattern" asserts `hasMissingParent === true` to document the problem rather than assert it is fixed — this is intentional and clearly labelled. The second test asserts the fixed pattern.
- No commits created (per instructions — all changes uncommitted).
