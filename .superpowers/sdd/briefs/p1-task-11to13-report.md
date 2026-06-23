# Tasks 11-13 Implementation Report

## T11 — Button loading state

**Files modified:**
- `apps/web/components/kit/button.tsx` — added `loading?: boolean` to `ButtonProps`; imports `Spinner`; adds `SPINNER_SIZE` map keyed by the existing size tokens (28/30/32/34/40 → 12/13/13/14/15px); when `loading` is true, overrides `leadingIcon` with a `<Spinner>`, sets `disabled={disabled || loading}`, adds `aria-busy={loading || undefined}`.
- `apps/web/components/kit/__tests__/button.test.tsx` — added 3 new cases: loading→disabled+aria-busy+role=status spinner; loading overrides leadingIcon; not-loading unaffected.

**API:** `<Button loading>Label</Button>` — label stays visible (stable width), Spinner size matched to button size.

**Tests:** 3 new cases, 8 total in button.test.tsx — all pass.

---

## T12 — Accordion primitive

**Files created:**
- `apps/web/components/kit/accordion.tsx` — built over `@radix-ui/react-accordion` (already installed). API: `Accordion({ items: {id,title,content}[], type?: "single"|"multiple", defaultValue?, className? })`. Full-border items (`border border-border rounded-lg`), chevron rotates via `[&[data-state=open]>svg]:rotate-180` (transform only), content via Radix open/closed state. No layout animation.
- `apps/web/components/kit/__tests__/accordion.test.tsx` — 6 cases: expand/collapse; re-click collapse (single); multiple type two-open; defaultValue; axe-clean closed; axe-clean open.

**Export added to** `apps/web/components/kit/index.ts` under Milestone 1e section: `Accordion`, `AccordionProps`, `AccordionItem`.

**Tests:** 6 cases — all pass.

---

## T13 — FormInput prefix/suffix slots

**Files modified:**
- `apps/web/components/kit/form-input.tsx` — added `prefix?: ReactNode` / `suffix?: ReactNode` to `FormInputProps` (with `"prefix"` added to the `Omit<>` from `InputHTMLAttributes` to resolve the native `prefix: string | undefined` type conflict). When either slot is present: input becomes borderless+flex (classes `min-w-0 flex-1 h-9 px-0`), border/ring move to a flex wrapper using `focus-within:` for the ring. Adornments rendered as `aria-hidden` `<span>` with `px-2 text-sm text-text-muted`. All existing error/aria-invalid/aria-describedby/label wiring preserved; 36px height maintained.
- `apps/web/components/kit/__tests__/form-input.test.tsx` — added 3 new cases: prefix+suffix render; error/aria-invalid still wired with slots; aria-describedby still wired to error message with slots.

**Tests:** 4 existing + 3 new = 7 total in form-input.test.tsx — all pass.

---

## Full suite

- **Kit suite:** 31 files, 171 tests — all pass.
- **Full apps/web suite:** 125 files, **745 tests** — all pass (was 733; +12 new).
- **type-check:** clean (one fix needed: `Omit<..., "prefix">` to resolve `ReactNode` vs `string | undefined` conflict on the native HTML attr).
- **lint:** clean (`next lint` — no ESLint warnings or errors).

## Concerns

- `HTMLCanvasElement.getContext()` warnings appear throughout the suite — these are pre-existing jsdom limitations from chart components (BarChart/Sparkline), not introduced by this block.
- The `<Spinner>` used in Button loading uses `variant="accent"` (not the default `"ai"`) so it matches non-AI button contexts; this is a deliberate choice but could be made configurable in a future pass if needed.
- Radix Accordion content visibility in jsdom: `toBeVisible()` works correctly because Radix sets `hidden` attribute on closed content, which jsdom respects.
