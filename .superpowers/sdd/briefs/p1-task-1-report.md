# Task 1 Report — WCAG-AA Contrast Fix

**Branch:** feat/alexandria-ui  
**Date:** 2026-06-23  
**Status:** COMPLETE — all gates green

---

## Summary

Fixed two families of WCAG-AA contrast failures:

1. `--text-faint` was below 4.5:1 in both themes.
2. `destructive` button fill (`bg-danger + text-white`) failed in dark theme (white on `#e07a4f` = 2.97:1).

A dedicated `--danger-solid` / `--danger-solid-fg` token pair was introduced for the button fill (the semantic `--danger` token is intentionally kept light in dark theme for text-on-muted use).

The dark `--text-faint` was nudged from the spec's `#9a8e6d` to `#9b8f6e` because the spec value narrowly missed AA on `--surface-muted` (4.487:1 < 4.5:1). The light value `#786a47` and all danger-solid values are verbatim from the spec.

---

## Exact Diffs

### `apps/web/app/globals.css`

**`:root` — line 23 (--text-faint)**
```diff
-  --text-faint: #a3977c;
+  --text-faint: #786a47;
```

**`:root` — after --danger-text**
```diff
   --danger-text: #9a3412;
+  --danger-solid: #c2410c;
+  --danger-solid-fg: #fffdf7;
```

**`[data-woa="dark"]` — line 82 (--text-faint)**
```diff
-  --text-faint: #857a61;
+  --text-faint: #9b8f6e;
```

**`[data-woa="dark"]` — after --danger-text**
```diff
   --danger-text: #f0a07f;
+  --danger-solid: #b5431f;
+  --danger-solid-fg: #fff7f3;
```

**`@theme inline` — after --color-danger-text**
```diff
   --color-danger-text: var(--danger-text);
+  --color-danger-solid: var(--danger-solid);
+  --color-danger-solid-fg: var(--danger-solid-fg);
```

### `apps/web/components/kit/button.tsx`

```diff
-        destructive:
-          "border-none bg-danger text-white font-semibold hover:brightness-95",
+        destructive:
+          "border-none bg-danger-solid text-danger-solid-fg font-semibold hover:brightness-95",
```

### `apps/web/components/kit/__tests__/contrast.test.ts` (new file)

Deterministic WCAG unit test with an inline `contrastRatio(hexFg, hexBg)` helper (WCAG relative-luminance formula). 9 assertions across both themes.

---

## Computed Contrast Ratios

All values asserted in `contrast.test.ts`:

| Token pair | Theme | Ratio | AA (≥4.5) |
|---|---|---|---|
| `--text-faint #786a47` on `--bg #f6f1e6` | light | **4.718** | PASS |
| `--text-faint #786a47` on `--surface #fffdf7` | light | **5.225** | PASS |
| `--text-muted #6e6450` on `--bg #f6f1e6` | light | **5.176** | PASS (regression guard) |
| `--danger-solid-fg #fffdf7` on `--danger-solid #c2410c` | light | **5.091** | PASS |
| `--text-faint #9b8f6e` on `--bg #1b1712` | dark | **5.559** | PASS |
| `--text-faint #9b8f6e` on `--surface #252019` | dark | **5.040** | PASS |
| `--text-faint #9b8f6e` on `--surface-muted #2e2820` | dark | **4.545** | PASS |
| `--text-muted #b5a98b` on `--bg #1b1712` | dark | **7.652** | PASS (regression guard) |
| `--danger-solid-fg #fff7f3` on `--danger-solid #b5431f` | dark | **5.241** | PASS |

---

## Commands and Results

```
# TDD red phase (test written first, hardcoding new values)
corepack pnpm -C apps/web exec vitest run components/kit/__tests__/contrast.test.ts
→ 1 failed (--text-faint on --surface-muted dark: #9a8e6d gave 4.487:1)

# Nudge dark text-faint #9a8e6d → #9b8f6e, update test fixture

# TDD green phase (all token + button edits applied)
corepack pnpm -C apps/web exec vitest run components/kit/__tests__/contrast.test.ts components/kit/__tests__/button.test.tsx
→ 2 passed (14 tests)

# Type-check
corepack pnpm -C apps/web type-check
→ exit 0, no errors

# Lint
corepack pnpm -C apps/web lint
→ No ESLint warnings or errors
```

---

## Concerns

1. **Dark `--text-faint` deviation from spec:** The spec precomputed `#9a8e6d`; the actual value used is `#9b8f6e` (one step lighter in each channel) because the spec value gives 4.487:1 on `--surface-muted` (2px short of AA). The surface-muted assertion is required by the task brief. The visual difference is imperceptible (~0.4% luminance change).

2. **`--danger-solid` light = `--danger` light:** In the light theme, `--danger-solid: #c2410c` is the same hex as `--danger: #c2410c`. This is intentional — they diverge only in dark mode where the semantic `--danger` (`#e07a4f`) must stay light for text-on-muted usage. The `--danger-solid` token exists so the button can independently track a dark-theme AA-passing fill without altering the semantic token.

3. **Step 1 / Step 4 (live browser verification) skipped** per task instructions — the controller handles the live Lighthouse + contrast sweep pass at T14.
