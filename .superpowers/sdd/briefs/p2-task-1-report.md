# Phase 2 Task 1 Report — Consolidate first-run onboarding

## How the modal was auto-opened before

`HowItWorksFirstRun` (exported from `components/onboarding/how-it-works.tsx`) was
mounted unconditionally inside `AppShell` alongside `HowItWorks`. On every mount it
ran a `useEffect` that read `localStorage.getItem(HOW_IT_WORKS_KEY)` and, if the
flag was absent, immediately called `useUIStore.getState().openHowItWorks()`. On a
true first load of `/projekt` this fired while the `OnboardingBanner` ("Három lépés
az elso fejezetedig") was also rendering — two onboarding patterns stacked.

## What changed

| File | Change |
|---|---|
| `components/onboarding/how-it-works.tsx` | `HowItWorksFirstRun` gutted to a no-op (`return null`); `useEffect` + `useLayoutEffect`-only `useEffect` import removed. The `HowItWorks` modal itself is untouched. |
| `components/shell/app-shell.tsx` | No JSX change needed; `HowItWorksFirstRun` is still mounted but now renders nothing. |
| `components/shell/top-bar.tsx` | Added `openHowItWorks` selector + a `CircleHelp` icon button ("Hogyan mukodik?") in the right cluster, between the search button and the theme toggle. Wrapped in a `Tooltip`. Always visible (not gated on `inBook`). |
| `lib/i18n/hu.ts` | Added `topbar.helpAria: "Hogyan mukodik?"` — all copy via `hu.ts`, no hardcoded strings. |
| `components/onboarding/__tests__/how-it-works.test.tsx` | `HowItWorksFirstRun` suite rewritten: "opens on first run" flipped to "does NOT auto-open"; added "modal title absent on mount (no stacking)" and "opens via store (on-demand path)" assertions. The "dismissal persists" test updated to open via the store rather than via auto-open. |
| `components/shell/__tests__/top-bar.test.tsx` | Added two tests: help button always present (inBook false) and opens the modal on click; help button present inside a book. |

## Help trigger placement

The `?` button (`CircleHelp`, 16px) sits in the TopBar right cluster between the
search icon and the theme toggle. This is consistent with the existing icon-button
chrome (same `h-8 w-8` size, same hover style) and is always reachable regardless
of route.

## Test summary

**749 passed / 0 failed** (125 test files) — up from 745 before this task (4 new
tests added). `tsc --noEmit`: no errors. ESLint: no warnings or errors.

## Concerns

- `HowItWorksFirstRun` is still exported and mounted in `AppShell` as a no-op. It
  can be deleted in a future cleanup pass once any external call-sites (command
  palette data, etc.) are confirmed clear. Left as-is to avoid a wider refactor
  scope than this task required.
- The `DailySpark` button in `projects-dashboard.tsx` contains a `border-l-[3px]
  border-l-accent` left accent stripe (house-rule violation). Not introduced by
  this task; flagged for a future sweep.
