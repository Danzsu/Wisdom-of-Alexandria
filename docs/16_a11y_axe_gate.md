# 16 — Accessibility (axe-core) test gate + Lighthouse follow-up (UX-4b)

## What this is

An automated accessibility quality gate that runs **inside the existing Vitest
suite** (`apps/web`). It is the objective, runnable complement to the heuristic
UX review and the "AI tell" detector: where a real, machine-detectable a11y
defect exists, the gate fails the build.

It uses **`vitest-axe`** (the `toHaveNoViolations` matcher + the `axe()` runner,
backed by **`axe-core`**).

## How it is wired

- `vitest.setup.ts` registers the axe matcher globally
  (`expect.extend(axeMatchers)`), so every test can assert
  `expect(results).toHaveNoViolations()`.
- `test/a11y.ts` exposes the shared helper **`expectNoA11yViolations(container,
  options?)`** with the project-wide rule config.
- `test/a11y-matchers.d.ts` pulls in the `vitest-axe/extend-expect` type
  augmentation so the matcher type-checks under strict mode.
- The a11y tests live alongside the components they cover, named
  `*.a11y.test.tsx`:
  - `components/kit/__tests__/kit.a11y.test.tsx` — the primitives.
  - `components/__tests__/screens.a11y.test.tsx` — the screens / regions.
  - `components/shell/__tests__/shell-drawer.a11y.test.tsx` — the responsive
    drawers.

Because these are ordinary Vitest files, they are picked up by `pnpm test` and
therefore by the existing **`ci-frontend`** GitHub Actions job — **no separate CI
step is needed.**

## Rules that are disabled, and why

The gate keeps every structural / semantic rule enabled (roles, accessible
names, labels, `aria-*`, list structure, `button-name`, `image-alt`, form
labels, duplicate ids, landmarks, heading order). Only two rules are scoped off,
both for unavoidable **jsdom** limitations — never to hide a real defect:

| Rule | Scope | Why |
| --- | --- | --- |
| `color-contrast` | All a11y assertions | axe computes contrast from *computed* layout colours. jsdom has no layout/paint engine and does not resolve our Tailwind token CSS variables, so every element resolves to transparent/black and axe either no-ops or emits false "insufficient contrast" hits. Contrast is owned by the design-token review and the Lighthouse follow-up below (real browser). |
| `region` | Only when scanning a whole `Document` (portalled overlays) | Isolated component tests render a bare overlay (dialog / menu / tooltip) with no surrounding page landmarks (`<main>`/`<nav>`), so the page-level `region` rule ("all content must live inside a landmark") always fires. That is a property of the test harness, not the component. `region` stays **enabled** for inline container scans. |

The gate was self-checked against a negative fixture (unlabeled `<img>`,
duplicate ids, empty `<button>`) and correctly reports `image-alt`,
`button-name`, and the duplicate-id rules — confirming the structural rules are
live.

## Surfaces covered

Primitives: Button (all variants), IconButton, FormInput (normal + error),
Textarea, CheckboxRow / RadioGroup / ToggleSwitch, Tab / TabBar, Badge /
StatusPill, AIResultCard, Modal (open), ConfirmDialog (open), Tooltip (open),
PopoverMenu (open).

Screens / regions: projects dashboard, AI inspector tabs, Describe 6-channel
panel, new-relation modal (open), editor AI toolbar, command palette (open),
shortcuts overlay (open), relationship graph (with relations), chapter/scene
timeline, and the responsive shell drawers (chapter tree + AI inspector, open).

## Lighthouse — documented follow-up (NOT wired as a hard CI gate)

A live Lighthouse run needs the full app + backend running and is flaky in CI,
so it is intentionally **not** a build dependency. To add it later as an
opt-in/non-blocking job:

1. `pnpm --filter web add -D @lhci/cli`
2. Add `apps/web/lighthouserc.json`:

   ```json
   {
     "ci": {
       "collect": {
         "startServerCommand": "pnpm --filter web start",
         "url": ["http://localhost:3000/"],
         "numberOfRuns": 3
       },
       "assert": {
         "assertions": {
           "categories:accessibility": ["error", { "minScore": 0.95 }],
           "categories:performance": ["warn", { "minScore": 0.8 }]
         }
       },
       "upload": { "target": "temporary-public-storage" }
     }
   }
   ```

3. Add a **separate, non-blocking** CI job (runs after build, continues on
   error) that boots the web server and a mock/seeded API, then runs
   `lhci autorun`. Keep it advisory until the seeded-data fixture for CI is in
   place — the axe gate remains the hard accessibility gate.

This split keeps the hard gate fast and deterministic (axe, in-process) while
leaving real-browser contrast/performance auditing as a documented next step.
