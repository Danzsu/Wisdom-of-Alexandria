# Phase 2 — Per-Screen Visual Polish (the award-winning look)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Each task verified live in the browser (chrome-devtools) where it renders.

**Goal:** Turn the now-solid foundation (Phase 1) into an award-grade *look* by applying the audit's per-screen findings: one calm onboarding, consistent polished empty/loading/error states everywhere, and tightened visual hierarchy/micro-interactions on the hero screens.

**Architecture:** Frontend-only. Adopt the Phase-1 kit patterns (`EmptyState`, `SkeletonCard/List/Table`, `ErrorState`, the type scale) across the real screens; consolidate onboarding; polish hero screens with live verification. FTDD (vitest + vitest-axe); behavior preserved except where a finding mandates a deliberate change.

**Source:** `docs/superpowers/audits/2026-06-23-ui-ux-report.html`. Dev server runs at :3000 for live checks (backend may be down → verify what renders: dashboard, empty/error states, kit).

**Global constraints (for reviewers):** no `border-l/-r` colored accent stripe, no gradient text, no em dashes; all copy via `hu.ts`; every changed view keeps its tests + axe green; live a11y must stay 100 / contrast 0.

---

## Task 1: Consolidate the first-run onboarding
**Files:** `apps/web/components/onboarding/how-it-works.tsx`, the dashboard "Három lépés" banner (`apps/web/components/projects/projects-dashboard.tsx`), `apps/web/components/shell/app-shell.tsx` (whichever mounts the modal), tests.

The audit found the "Hogyan működik" **modal** stacks on top of the inline "Három lépés az első fejezetig" **banner** on first load — two onboarding patterns at once (cognitive load + modal-first). Pick ONE calm path: keep the inline banner as the primary first-run guide; demote the modal to an on-demand "Hogyan működik?" affordance (a help button / `?` overlay entry), NOT auto-opened on first run. Preserve the modal content; just change the trigger. Test: on first run (no seen-flag) the modal does NOT auto-open; the banner shows; the help affordance opens the modal on click. Verify live on `/projekt`.

- [ ] Write failing test (first-run does not auto-open the modal; help button opens it) → implement (gate the modal behind the help trigger, keep the banner) → pass → live screenshot `/projekt` (only the banner, no stacked modal) → commit.

## Task 2: State-pattern adoption — list screens
**Files:** `timeline/timeline-screen.tsx`, `relations/relations-screen.tsx`, `plotlines/plotlines-screen.tsx`, `jobs/jobs-screen.tsx` + their tests.

Replace ad-hoc empty/loading/error markup with the Phase-1 primitives: empty → `EmptyState` (icon + Hungarian copy + a CTA where one exists, e.g. "Új kapcsolat"); loading → `SkeletonList`/`SkeletonCard` instead of a bare `Spinner`; error → inline `ErrorState` (retry) instead of a `<p role="status">`. Keep each screen's existing data hooks + CTAs. Per screen: update the test to find the new pattern; axe-clean.

- [ ] Per screen: failing test → swap to the pattern → pass → commit (one commit for the group, or per screen).

## Task 3: State-pattern adoption — board, research, codex
**Files:** `plan/plan-board.tsx`, `research/research-screen.tsx`, `codex/codex-detail.tsx` (+ the codex sidebar/list) + tests.

Same adoption as Task 2 for these. Plan-board empty → `EmptyState` with the existing "Első fejezet létrehozása" CTA; loading → `SkeletonCard` grid; codex/research empties + errors → `EmptyState`/`ErrorState`. Preserve behavior.

- [ ] Per surface: failing test → swap → pass → commit.

## Task 4: Hero-screen visual hierarchy + micro-interactions (live-iterated)
**Files:** the hero screens that render without backend first — `projects-dashboard.tsx` (dashboard) + the `cover-panel`/`image-panel` controls; then Write/Plan/Codex when backend data is available.

This is the subjective, taste-driven pass — done LIVE with screenshots. For each: tighten visual hierarchy (one clear focal point, spacing rhythm using the type scale, restrained accent use), add tasteful micro-interactions (hover/active states already exist — fill gaps), ensure the canonical "hero moment" reads. Propose concrete changes, verify each live (before/after screenshot), keep it on-brand (warm, calm, gold; no clutter). Surface bigger visual direction choices to the user rather than guessing.

- [ ] Dashboard polish (live) → commit. - [ ] Cover/image control polish (live) → commit. - [ ] (Backend-up) Write/Plan/Codex hero polish → commit.

## Task 5: Sanity + live re-verify + LOW sweep
- [ ] Sweep the 2 logged Phase-1 LOWs (StatusDot `{...props}` role-override hardening; remove dead `sharedProps.collapsible` in Accordion).
- [ ] Full `apps/web` suite + tsc + lint + shared-types fresh.
- [ ] Live: a11y stays 100, contrast 0 on the touched screens (light + dark); responsive spot-check at mobile/tablet/desktop on the dashboard.
- [ ] Commit.

---

## Deferred (note, not done this phase)
- **Type-scale screen migration** (~74 non-kit files `text-[Npx]` → `text-body` etc.): invisible consistency hygiene; the names are non-colliding so it's safe but low visual value. Do as a later mechanical sweep.
- Deep Write-editor / content-rich polish needs the backend running for representative content.

## Verification
Per task: its vitest + axe green; live screenshot of the changed screen (light + dark) shows the intended result; a11y 100 / contrast 0 maintained. End of phase: full suite + tsc + lint + shared-types fresh.
