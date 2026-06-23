# Design-System Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the systemic, award-blocking gaps the UI/UX audit found — WCAG-AA contrast, three kit ARIA defects, missing scale tokens, missing state-pattern components, and missing form primitives — without changing the product's look.

**Architecture:** Frontend-only (`apps/web`). Fix accessibility first (CSS tokens + three kit one-liners + one client.ts message), then add scale tokens to `globals.css @theme` (codify current values exactly, so zero visual diff), then build a state-pattern library (skeleton/empty/error) and the missing primitives (Select, loading-button, Accordion, input slots). Verified live in a real browser (chrome-devtools Lighthouse + a WCAG contrast sweep).

**Tech Stack:** Next.js 15 + Tailwind 4 (`@theme`), Radix UI, CVA, Vitest + `vitest-axe`, chrome-devtools MCP for live verification.

**Audit source:** `docs/superpowers/audits/2026-06-23-ui-ux-report.html`. Shared types are NOT touched (no backend change).

**Global constraints (hand to every reviewer):**
- Behavior/visual-preserving where stated (token migration must not change rendered output until a deliberate refine step).
- Every changed/new component keeps the axe gate green (`apps/web/components/kit/__tests__/kit.a11y.test.tsx` + `test/a11y.ts`).
- No hardcoded UI strings — Hungarian copy in `apps/web/lib/i18n/hu.ts`.
- No `border-left`/`-right` colored accent stripes, no gradient text, no em dashes in copy (house rules).
- After each task: the touched vitest files pass; end of phase: full `apps/web` suite + `type-check` + `lint` green.

**Live verification harness (used in several tasks):** with the dev server running (`pnpm -C apps/web dev`, http://localhost:3000), use chrome-devtools MCP `lighthouse_audit` (accessibility) and this contrast sweep (run via `evaluate_script`) to confirm 0 failures:

```js
// returns {distinctFailures, totalFailingNodes, failures:[{ratio,required,color,bg,sample}]}
// (full function in the audit session; flags any text node below 4.5:1 / 3:1 large)
```

Baseline to beat: kit-showcase a11y **84 → ≥95**; contrast sweep **86 failing nodes → 0** (light + dark).

---

## File Structure

- `apps/web/app/globals.css` — fix `--text-faint` (both themes) + danger-fill AA; add `--text-*`/`--space-*`/`--radius-*` scale tokens to `@theme`.
- `apps/web/components/kit/progress-bar.tsx` — accessible name.
- `apps/web/components/kit/status-dot.tsx` — `role="img"` when labelled (fixes DiffPane).
- `apps/web/app/kitchen-sink/page.tsx` (+ any real bare-`Tab` usage) — wrap `Tab`s in `TabBar`.
- `apps/web/lib/api/client.ts` — localize the transport-error message.
- `apps/web/components/kit/skeleton-patterns.tsx` (new) — `SkeletonCard/List/Table`.
- `apps/web/components/kit/empty-state.tsx` (new) — `EmptyState`; `screen-placeholder.tsx` re-expressed on top of it.
- `apps/web/components/kit/error-state.tsx` (new) — inline `ErrorState`.
- `apps/web/components/kit/select.tsx` (new, Radix) — `Select`; adopted in `components/book/cover-panel.tsx` + `components/codex/image-panel.tsx`.
- `apps/web/components/kit/button.tsx` — `loading` state.
- `apps/web/components/kit/accordion.tsx` (new, Radix).
- `apps/web/components/kit/form-input.tsx` — prefix/suffix slots.
- `apps/web/components/kit/index.ts` — barrel exports for all new components.
- Tests colocated under `apps/web/components/kit/__tests__/` + `apps/web/lib/api/__tests__/`.

---

## Task 1: WCAG-AA contrast — `--text-faint` + destructive fill

**Files:** Modify `apps/web/app/globals.css`; Modify `apps/web/components/kit/button.tsx` (destructive variant if needed); verify live.

- [ ] **Step 1: Capture the baseline live.** With the dev server up, open `http://localhost:3000/kitchen-sink` and run the contrast sweep (light + dark). Expected: `--text-faint` fails (light `#a3977c` 2.56:1; dark `#857a61` 4.21:1), white-on-danger 2.97:1 (dark). Record counts.

- [ ] **Step 2: Darken `--text-faint` in both themes.** In `globals.css`, line 23 (`:root`) and line 82 (`[data-woa="dark"]`):

```css
/* :root (light) — was #a3977c (2.56:1, FAIL) */
--text-faint: #786a47;
/* [data-woa="dark"] — was #857a61 (4.21:1, FAIL) */
--text-faint: #9a8e6d;
```

- [ ] **Step 3: Make the destructive fill AA with its text.** Read `button.tsx`'s `destructive` variant. The danger fill + on-color text must reach ≥4.5:1 in BOTH themes. White on light `--danger` `#c2410c` already passes (~4.6:1); dark `--danger` `#e07a4f` + white = 2.97 (FAIL). Add a dedicated button-fill token rather than darkening the semantic `--danger` (which must stay light for text-on-dark-surface use). In `globals.css` add to `:root` and `[data-woa="dark"]`, and map in `@theme`:

```css
/* :root */            --danger-solid: #c2410c; --danger-solid-fg: #fffdf7;
/* [data-woa=dark] */  --danger-solid: #b5431f; --danger-solid-fg: #fff7f3;
/* @theme inline */    --color-danger-solid: var(--danger-solid);
                        --color-danger-solid-fg: var(--danger-solid-fg);
```

Point the destructive button variant at `bg-danger-solid text-danger-solid-fg` (replace its current `bg-danger`/white).

- [ ] **Step 4: Verify live + adjust.** Reload, re-run the sweep in light AND dark. Expected: **0 contrast failures**. If `--text-faint` still falls short on `--surface` (`#fffdf7` light) or the danger fill < 4.5:1, nudge the hex darker and re-run until both themes pass. Run `lighthouse_audit` (accessibility) on `/kitchen-sink`: the `color-contrast` audit must now pass.

- [ ] **Step 5: Guard it with a unit test.** Add `apps/web/components/kit/__tests__/contrast.test.ts` that imports the token hex values (read from a small exported map or hardcode the new values) and asserts the WCAG ratio of `--text-faint`/`--text-muted` on `--bg` and `--surface` ≥ 4.5, and `--danger-solid-fg` on `--danger-solid` ≥ 4.5, for both themes. Include a `contrastRatio(hexFg, hexBg)` helper in the test. This freezes the fix against future token edits.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/app/globals.css apps/web/components/kit/button.tsx apps/web/components/kit/__tests__/contrast.test.ts
git commit -m "fix(a11y): WCAG-AA contrast for --text-faint + destructive fill (both themes)"
```

---

## Task 2: ProgressBar accessible name

**Files:** Modify `apps/web/components/kit/progress-bar.tsx`; Test `apps/web/components/kit/__tests__/progress-bar.test.tsx`.

- [ ] **Step 1: Failing test.**

```tsx
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ProgressBar } from "@/components/kit/progress-bar";

it("exposes an accessible name + valuetext", () => {
  render(<ProgressBar value={30} aria-label="Feltöltés" />);
  const bar = screen.getByRole("progressbar", { name: "Feltöltés" });
  expect(bar).toHaveAttribute("aria-valuetext", "30%");
});
it("has a default accessible name when none is given", () => {
  render(<ProgressBar value={10} />);
  expect(screen.getByRole("progressbar")).toHaveAccessibleName();
});
it("is axe-clean", async () => {
  const { container } = render(<ProgressBar value={50} aria-label="X" />);
  expect(await axe(container)).toHaveNoViolations();
});
```

- [ ] **Step 2: Run → FAIL** (`corepack pnpm -C apps/web exec vitest run components/kit/__tests__/progress-bar.test.tsx`): no accessible name.

- [ ] **Step 3: Implement.** In `progress-bar.tsx`, accept `"aria-label"?: string` on the base props, and on the `role="progressbar"` div add:

```tsx
aria-label={domProps["aria-label"] ?? "Folyamatjelző"}
aria-valuetext={indeterminate ? undefined : `${Math.round(pct)}%`}
```

(Destructure `"aria-label": ariaLabel` so it is not double-spread; use `ariaLabel ?? "Folyamatjelző"`.)

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit.** `git commit -m "fix(a11y): ProgressBar accessible name + valuetext"`

---

## Task 3: StatusDot — valid label (fixes DiffPane prohibited-attr)

**Files:** Modify `apps/web/components/kit/status-dot.tsx`; Test `apps/web/components/kit/__tests__/status-dot.test.tsx` (extend if present).

- [ ] **Step 1: Failing test.**

```tsx
it("a labelled dot is an img role (aria-label is valid)", () => {
  render(<StatusDot variant="danger" aria-label="Eredeti" />);
  expect(screen.getByRole("img", { name: "Eredeti" })).toBeInTheDocument();
});
it("an unlabelled dot is hidden from AT", () => {
  const { container } = render(<StatusDot variant="success" />);
  expect(container.querySelector("span")).toHaveAttribute("aria-hidden", "true");
});
```

- [ ] **Step 2: Run → FAIL** (no `img` role; `aria-label` on a role-less span is prohibited).

- [ ] **Step 3: Implement.** In all four `return` branches of `status-dot.tsx`, add `role={ariaLabel ? "img" : undefined}` alongside the existing `aria-label`/`aria-hidden`. (Cleanest: compute `const a11y = ariaLabel ? { role: "img", "aria-label": ariaLabel } : { "aria-hidden": true as const };` once and spread `{...a11y}` in each branch.)

- [ ] **Step 4: Run → PASS.** Also re-run `diff-pane` tests if any.

- [ ] **Step 5: Commit.** `git commit -m "fix(a11y): StatusDot uses role=img when labelled (fixes DiffPane aria)"`

---

## Task 4: Tabs always inside a tablist

**Files:** Modify `apps/web/app/kitchen-sink/page.tsx` (+ any real bare-`Tab` usage found); Test extends the kit a11y test.

- [ ] **Step 1: Find bare usages.** `grep -rn "<Tab\b" apps/web --include=*.tsx | grep -v TabBar` and inspect each: a `<Tab>` whose nearest ancestor is not a `<TabBar>` (role="tablist") triggers Lighthouse `aria-required-parent`. The kitchen-sink showcase is the known offender; confirm whether any real screen (e.g. inspector) renders `Tab` outside `TabBar`.

- [ ] **Step 2: Failing test.** Add to `kit.a11y.test.tsx`: render the exact tab grouping pattern used by the offending site WITHOUT a TabBar and assert axe flags it; then with `TabBar` it is clean. (If axe-core under jsdom does not flag `aria-required-parent`, instead assert structurally that every rendered `role="tab"` has an ancestor with `role="tablist"` via a small DOM walk helper.)

- [ ] **Step 3: Fix.** Wrap the bare `Tab`s in `<TabBar aria-label="…">…</TabBar>` (kitchen-sink demo + any real usage). No component change needed — `TabBar` already provides `role="tablist"` + roving keyboard nav.

- [ ] **Step 4: Verify live.** `lighthouse_audit` on `/kitchen-sink`: `aria-required-parent` now passes.

- [ ] **Step 5: Commit.** `git commit -m "fix(a11y): wrap standalone Tabs in a TabBar (tablist parent)"`

---

## Task 5: Localize the transport-error message

**Files:** Modify `apps/web/lib/api/client.ts`; Test `apps/web/lib/api/__tests__/client.test.ts` (extend or create).

- [ ] **Step 1: Failing test.** Simulate a transport failure (mock `fetch` to reject with `new TypeError("Failed to fetch")`) and assert the thrown `ApiError.message` is the Hungarian string, not "Failed to fetch", while `ApiError.body` still carries the original cause.

```tsx
it("transport failure surfaces a localized message (not the raw browser string)", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await expect(apiFetch("/projects")).rejects.toMatchObject({
    status: 0,
    message: "Nem sikerült elérni a szervert. Ellenőrizd a kapcsolatot.",
  });
});
```

- [ ] **Step 2: Run → FAIL** (message is "Failed to fetch").

- [ ] **Step 3: Implement.** In `client.ts` lines 172–180 replace the `cause.message` passthrough with a fixed localized message, keeping the cause for debugging:

```ts
} catch (cause) {
  // Network/transport failure (CORS, server down, aborted). The browser's raw
  // "Failed to fetch" is dev jargon, never shown to the user — always surface a
  // localized message; keep the original cause as the error body for debugging.
  throw new ApiError(0, "Nem sikerült elérni a szervert. Ellenőrizd a kapcsolatot.", cause);
}
```

(If `signal?.aborted`, keep the existing abort behavior — do not convert an intentional cancel into this error; guard with `if (cause instanceof DOMException && cause.name === "AbortError") throw cause;` first.)

- [ ] **Step 4: Run → PASS.** Verify no other test asserted on the raw "Failed to fetch".

- [ ] **Step 5: Commit.** `git commit -m "fix(ux): localize transport-error message (no raw 'Failed to fetch')"`

---

## Task 6: Scale tokens (type · spacing · radius), behavior-preserving

**Files:** Modify `apps/web/app/globals.css` (the `@theme inline` block, lines 129–189).

- [ ] **Step 1: Add the scales — codifying CURRENT values so nothing renders differently.** Append inside `@theme inline`:

```css
  /* Type scale (codifies today's hardcoded text-[Xpx]). */
  --text-2xs: 10px;  --text-2xs--line-height: 1.4;
  --text-xs: 11px;   --text-xs--line-height: 1.45;
  --text-sm: 12px;   --text-sm--line-height: 1.5;
  --text-base: 13px; --text-base--line-height: 1.55;
  --text-md: 14px;   --text-md--line-height: 1.55;
  --text-lg: 15px;   --text-lg--line-height: 1.5;
  --text-xl: 17px;   --text-xl--line-height: 1.45;
  --text-2xl: 24px;  --text-2xl--line-height: 1.2;
  --text-3xl: 26px;  --text-3xl--line-height: 1.25;
  /* Radius scale (codifies rounded-[6/8/10/12/14]). */
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 10px; --radius-xl: 12px; --radius-2xl: 14px;
```

(Spacing already uses Tailwind's 4px scale + the named layout `--spacing-*` widths already present; do NOT introduce a parallel `--space-*` that duplicates Tailwind's default scale. Document that spacing = Tailwind 4px grid, and add only the few semantic gaps the kit repeats, e.g. `--spacing-field: 36px` for control height, if a later task needs it.)

- [ ] **Step 2: Verify zero visual change.** `corepack pnpm -C apps/web exec vitest run` (all green) + boot the dev server and screenshot `/projekt` + `/kitchen-sink` (light + dark) — they must look identical to the audit screenshots. The new utilities (`text-base`, `rounded-lg`, etc.) now resolve to the same px values arbitrary classes used.

- [ ] **Step 3: Migrate the kit to named utilities (mechanical, still no visual change).** In `apps/web/components/kit/*`, replace arbitrary `text-[13px]`→`text-base`, `text-[12px]`→`text-sm`, `text-[11px]`→`text-xs`, `text-[14px]`→`text-md`, `text-[10px]`→`text-2xs`, `text-[24px]`→`text-2xl`, `text-[26px]`→`text-3xl`; `rounded-[10px]`→`rounded-lg`, `rounded-[6px]`→`rounded-sm`, etc. Do it kit-only this task (screens come in Phase 2). Run the kit tests + a screenshot diff to confirm identical rendering.

- [ ] **Step 4: Commit.** `git commit -m "feat(ds): type + radius scale tokens; migrate kit off arbitrary sizes (no visual change)"`

---

## Task 7: Skeleton pattern library

**Files:** Create `apps/web/components/kit/skeleton-patterns.tsx`; Test `apps/web/components/kit/__tests__/skeleton-patterns.test.tsx`; export from `index.ts`.

- [ ] **Step 1: Failing test.**

```tsx
import { render, screen } from "@testing-library/react";
import { SkeletonCard, SkeletonList, SkeletonTable } from "@/components/kit/skeleton-patterns";

it("SkeletonList renders N rows, all aria-hidden", () => {
  render(<SkeletonList rows={4} />);
  const root = screen.getByTestId("skeleton-list");
  expect(root.querySelectorAll(".woa-skel").length).toBeGreaterThanOrEqual(4);
  expect(root).toHaveAttribute("aria-hidden", "true");
});
it("SkeletonTable renders rows × cols", () => {
  render(<SkeletonTable rows={3} cols={4} />);
  expect(screen.getByTestId("skeleton-table").querySelectorAll(".woa-skel").length).toBe(12);
});
```

- [ ] **Step 2: Run → FAIL** (module missing).

- [ ] **Step 3: Implement** using the existing `Skeleton` primitive (`apps/web/components/kit/skeleton.tsx`). Each wrapper is `aria-hidden` (decorative) with a `data-testid`. `SkeletonCard` = a card-shaped block (title line + 2-3 body lines), `SkeletonList({rows})` = stacked rows, `SkeletonTable({rows,cols})` = a grid of cells. Compose only `Skeleton` + flex/grid; reuse `rounded-lg`/`gap-*` from the scale.

- [ ] **Step 4: Run → PASS.** Add a `kit.a11y` case (axe-clean).

- [ ] **Step 5: Commit.** `git commit -m "feat(ds): SkeletonCard/List/Table patterns"`

---

## Task 8: EmptyState component (+ re-express ScreenPlaceholder)

**Files:** Create `apps/web/components/kit/empty-state.tsx`; Modify `apps/web/components/shell/screen-placeholder.tsx`; Test `apps/web/components/kit/__tests__/empty-state.test.tsx`; export from `index.ts`.

- [ ] **Step 1: Failing test.**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { EmptyState } from "@/components/kit/empty-state";
import { ImageIcon } from "lucide-react";

it("renders title, description, and a working CTA", async () => {
  const onAct = vi.fn();
  render(<EmptyState icon={<ImageIcon />} title="Nincs még borító" description="Generálj egyet." action={{ label: "Borító generálása", onClick: onAct }} />);
  expect(screen.getByRole("heading", { name: "Nincs még borító" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Borító generálása" }));
  expect(onAct).toHaveBeenCalledOnce();
});
it("is axe-clean", async () => {
  const { container } = render(<EmptyState title="Üres" />);
  expect(await axe(container)).toHaveNoViolations();
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `EmptyState`** — props `{ icon?, title, description?, action?: { label, onClick } | ReactNode, className? }`. Centered column: icon in a soft rounded badge (reuse the `bg-accent-muted text-accent-text` treatment from the existing `V1Placeholder` in `codex-detail.tsx`), serif title (`font-serif text-xl`), muted description (`text-base text-text-muted`, `max-w-prose`), optional CTA (`Button variant="accent-outline"`). Decorative icon `aria-hidden`.

- [ ] **Step 4: Re-express `ScreenPlaceholder` on top of EmptyState** (keep its `{label, hint}` API so the 3 placeholder routes are unchanged): render `<EmptyState icon={<BrandStar/>} title={label} description={hint} />`. Confirm `attekintes`/`promptok`/`hangok` still render.

- [ ] **Step 5: Run → PASS** (+ existing screen-placeholder/route tests).

- [ ] **Step 6: Commit.** `git commit -m "feat(ds): EmptyState component; ScreenPlaceholder built on it"`

---

## Task 9: Inline ErrorState (+ adopt on the dashboard)

**Files:** Create `apps/web/components/kit/error-state.tsx`; Modify the projects dashboard error branch (`apps/web/components/projects/*` — the "Nem sikerült betölteni" block) to use it; Test `apps/web/components/kit/__tests__/error-state.test.tsx`; `hu.ts` copy; export from `index.ts`.

- [ ] **Step 1: Failing test.**

```tsx
it("shows the message and retries", async () => {
  const onRetry = vi.fn();
  render(<ErrorState message="Nem sikerült betölteni a projekteket." onRetry={onRetry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Nem sikerült betölteni");
  await userEvent.click(screen.getByRole("button", { name: /Újrapróbálkozás/ }));
  expect(onRetry).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `ErrorState`** — props `{ message, detail?, onRetry?, className? }`. A compact panel with `role="alert"`, a danger icon (`AlertTriangle`, `aria-hidden`), the `message` (`text-md text-text`), optional muted `detail`, and a retry `Button` (label `hu.common.retry` = "Újrapróbálkozás"). Full border (no side-stripe). Mirror the visual weight of `apps/web/app/(app)/error.tsx` but inline (no full-screen).

- [ ] **Step 4: Adopt on the dashboard.** Replace the ad-hoc "Nem sikerült betölteni … Failed to fetch … Újrapróbálkozás" block in the projects dashboard with `<ErrorState message={hu.projects.loadError} detail={error.message} onRetry={refetch} />`. Because Task 5 localized transport errors, `error.message` is now Hungarian; `detail` is optional.

- [ ] **Step 5: Run → PASS** (+ the projects dashboard test that asserts the error branch).

- [ ] **Step 6: Commit.** `git commit -m "feat(ds): inline ErrorState; adopt on the projects dashboard"`

---

## Task 10: Radix Select primitive (+ replace native selects in image/cover panels)

**Files:** Create `apps/web/components/kit/select.tsx`; Modify `apps/web/components/book/cover-panel.tsx` + `apps/web/components/codex/image-panel.tsx`; Test `apps/web/components/kit/__tests__/select.test.tsx`; export from `index.ts`.

- [ ] **Step 1: Failing test.**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "@/components/kit/select";

it("selects an option via the listbox", async () => {
  const onChange = vi.fn();
  render(<Select aria-label="Stílus" value="a" onValueChange={onChange}
    options={[{ value: "a", label: "Realisztikus" }, { value: "b", label: "Festett" }]} />);
  await userEvent.click(screen.getByRole("combobox", { name: "Stílus" }));
  await userEvent.click(await screen.findByRole("option", { name: "Festett" }));
  expect(onChange).toHaveBeenCalledWith("b");
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** a thin wrapper over `@radix-ui/react-select` (already a transitive dep via other Radix kit parts; if not installed, add `@radix-ui/react-select`). API: `Select({ value, onValueChange, options: {value,label}[], placeholder?, "aria-label", disabled?, className? })`, styled to match `form-input.tsx` (36px trigger, `rounded-md`, focus ring `focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]`), portalled content with `shadow-popover`, check on the selected item. Mirror the existing `model-selector.tsx` Radix-Select styling for consistency.

- [ ] **Step 4: Replace the native `<select>`** in `cover-panel.tsx` (art-style + layout pickers) and `image-panel.tsx` (style picker) with `<Select>`. Keep the same labels (`hu.covers.artStyleLabel` etc.) via `aria-label`/`FieldLabel`. Re-run those panels' tests (`cover-panel.test.tsx`, `image-panel.test.tsx`); update queries from `getByLabelText(select)` to the combobox role if needed (Radix Select trigger is `role="combobox"`).

- [ ] **Step 5: Run → PASS** (select test + the two panel suites) + axe-clean case.

- [ ] **Step 6: Commit.** `git commit -m "feat(ds): Radix Select; replace native selects in cover + image panels"`

---

## Task 11: Button loading state

**Files:** Modify `apps/web/components/kit/button.tsx`; Test extends `apps/web/components/kit/__tests__/` (button test, or kit.a11y).

- [ ] **Step 1: Failing test.**

```tsx
it("loading shows a spinner, disables, and marks busy", () => {
  render(<Button loading>Mentés</Button>);
  const btn = screen.getByRole("button", { name: /Mentés/ });
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");
  expect(btn.querySelector('[role="status"]')).toBeInTheDocument(); // Spinner
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement.** Add `loading?: boolean` to `ButtonProps`. When true: render the kit `Spinner` (size matched to the button size) in the `leadingIcon` slot (overriding any provided leading icon), set `disabled = disabled || loading`, and add `aria-busy={loading}`. Keep the label visible (do not collapse to icon-only) so width is stable.

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit.** `git commit -m "feat(ds): Button loading state (spinner + aria-busy)"`

---

## Task 12: Accordion primitive

**Files:** Create `apps/web/components/kit/accordion.tsx`; Test `apps/web/components/kit/__tests__/accordion.test.tsx`; export from `index.ts`.

- [ ] **Step 1: Failing test.**

```tsx
it("expands and collapses an item", async () => {
  render(<Accordion items={[{ id: "a", title: "Részletek", content: <p>Tartalom</p> }]} />);
  const trigger = screen.getByRole("button", { name: "Részletek" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Tartalom")).toBeVisible();
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** over `@radix-ui/react-accordion` (add dep if missing). API: `Accordion({ items: {id,title,content}[], type?: "single"|"multiple", defaultValue?, className? })`. Style: full-border items, `rounded-lg`, chevron that rotates on open (transform only), content reveal via the project's reduced-motion-safe pattern. axe-clean.

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit.** `git commit -m "feat(ds): Accordion primitive"`

---

## Task 13: FormInput prefix/suffix slots

**Files:** Modify `apps/web/components/kit/form-input.tsx`; Test extends `apps/web/components/kit/__tests__/` (form-input test).

- [ ] **Step 1: Failing test.**

```tsx
it("renders prefix/suffix without breaking the label/error wiring", () => {
  render(<FormInput aria-label="Ár" prefix={<span>Ft</span>} suffix={<span>/db</span>} error="Kötelező" />);
  const input = screen.getByLabelText("Ár");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Ft")).toBeInTheDocument();
  expect(screen.getByText("/db")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement.** Add `prefix?: ReactNode` / `suffix?: ReactNode`. Wrap the `<input>` in a flex row that carries the border + focus-ring (move the border styling from the input to the wrapper when prefix/suffix is present), with the slots as muted, non-interactive adornments (`text-text-muted px-2`, `aria-hidden` unless interactive). Preserve `error`/`aria-invalid`/`aria-describedby` wiring and the 36px height.

- [ ] **Step 4: Run → PASS** (+ existing form-input tests).

- [ ] **Step 5: Commit.** `git commit -m "feat(ds): FormInput prefix/suffix slots"`

---

## Task 14: Phase-1 sanity + live a11y re-verification

**Files:** none (verification + a final barrel/export check).

- [ ] **Step 1: Barrel exports.** Confirm `apps/web/components/kit/index.ts` exports `SkeletonCard/List/Table`, `EmptyState`, `ErrorState`, `Select`, `Accordion` (and types). Add any missing.

- [ ] **Step 2: Full suites.**

```bash
corepack pnpm -C apps/web type-check
corepack pnpm -C apps/web lint
corepack pnpm -C apps/web exec vitest run
bash scripts/gen-shared-types.sh && git diff --exit-code packages/shared   # must be clean (FE-only phase)
```
Expected: all green; shared-types diff empty.

- [ ] **Step 3: Live a11y re-verification.** Dev server up; via chrome-devtools on `/kitchen-sink` (light + dark): run the contrast sweep → **0 failures**; `lighthouse_audit` accessibility → **≥95** (was 84), with `color-contrast`, `aria-progressbar-name`, `aria-prohibited-attr`, `aria-required-parent` all passing. Re-audit `/projekt` → still 100.

- [ ] **Step 4: Validation round.** No swallowed errors; no `border-l/-r` accent stripes or gradient text introduced; every new component axe-clean + keyboard-operable; no hardcoded strings (all via `hu.ts`). Fix any gap, re-run the affected suite.

- [ ] **Step 5: Commit.** `git commit -m "test(ds): Phase-1 design-system foundation sanity + live a11y re-verification"`

---

## Self-Review

**Spec coverage:** (1) AA contrast → T1; ARIA fixes → T2 (ProgressBar), T3 (StatusDot/DiffPane), T4 (Tab/tablist). (2) Scale tokens → T6. (3) State patterns: skeleton → T7, EmptyState → T8, ErrorState + "Failed to fetch" → T9 (+ T5 localizes the message). (4) Primitives: Select → T10, loading-button → T11, Accordion → T12, input slots → T13. Sanity + live re-verify → T14. No gaps.

**Placeholder scan:** concrete code + commands throughout; the only empirical values are the new `--text-faint`/`--danger-solid` hexes, which T1 Step 4 dials in against the live sweep (a real verification loop, not a TODO).

**Type/name consistency:** new exports — `SkeletonCard/SkeletonList/SkeletonTable` (T7), `EmptyState` with `action:{label,onClick}` (T8), `ErrorState` with `{message,detail?,onRetry?}` (T9), `Select` with `{value,onValueChange,options:{value,label}[],"aria-label"}` (T10), `Button.loading` (T11), `Accordion` with `items:{id,title,content}[]` (T12), `FormInput.prefix/suffix` (T13). These names are used identically in their adoption steps (cover/image panels for Select; dashboard for ErrorState; placeholder routes for EmptyState). `--danger-solid`/`--danger-solid-fg` (T1) are mapped in `@theme` and consumed by the destructive button variant. Consistent.
