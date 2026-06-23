# Task 6 — Scale Tokens: Safe Redo Report

## STATUS: COMPLETE

---

## Revert Confirmation
`git checkout -- apps/web/app/globals.css apps/web/components/kit` restored committed post-Task-5 state. Verified `git diff HEAD --stat` was empty before starting the redo. The faulty Task-6 attempt (which overrode Tailwind default names `text-xs/sm/base/lg/xl/2xl/3xl` and `radius-sm/md/lg/xl/2xl`) has been fully discarded.

---

## Tokens Added (globals.css — additive only)

Nine non-colliding semantic type-scale entries added to `apps/web/app/globals.css` `@theme inline`. NO Tailwind defaults redefined. NO radius tokens added (deferred — radius names collide with Tailwind defaults).

| Token | px | Line-height |
|-------|-----|-------------|
| `--text-micro` | 10px | 1.4 |
| `--text-tiny` | 11px | 1.45 |
| `--text-small` | 12px | 1.5 |
| `--text-body` | 13px | 1.55 |
| `--text-field` | 14px | 1.55 |
| `--text-lead` | 15px | 1.5 |
| `--text-title` | 17px | 1.45 |
| `--text-display` | 24px | 1.2 |
| `--text-hero` | 26px | 1.25 |

---

## Kit Text-Class Migration Count

Only `text-[Npx]` with exact px mappings replaced. `text-xs`, `text-sm`, `text-base` (Tailwind defaults) left untouched. Unmapped sizes `text-[16px]`, `text-[18px]`, `text-[20px]` left as arbitrary values.

| Token applied | Arbitrary replaced | Occurrences |
|--------------|-------------------|------------|
| `text-micro` | `text-[10px]` | 8 |
| `text-tiny` | `text-[11px]` | 11 |
| `text-small` | `text-[12px]` | 9 |
| `text-body` | `text-[13px]` | 16 |
| `text-field` | `text-[14px]` | 4 |
| `text-lead` | `text-[15px]` | 0 |
| `text-title` | `text-[17px]` | 1 |
| `text-display` | `text-[24px]` | 0 |
| `text-hero` | `text-[26px]` | 0 |

---

## Bonus Fix: tailwind-merge Extended
`apps/web/lib/utils.ts` updated to use `extendTailwindMerge` with the 9 new tokens registered in the `font-size` class group. Without this, tailwind-merge (v3.6) treated `text-micro` et al. as conflicting `text-*` utilities and dropped co-occurring color classes like `text-pov3-tx` — causing `badge.test.tsx` to fail. The extended config resolves the conflict correctly.

---

## Zero-Regression Verification
- No `rounded-*` class changed anywhere in the diff (identical values in `-`/`+` pairs).
- No existing `text-xs`/`text-sm`/`text-base` usage changed.
- No non-kit file changed (only additive `globals.css` block + `lib/utils.ts` tailwind-merge config).

---

## Full Suite: 705/705 passed (120 test files)
- **tsc --noEmit:** clean (0 errors)
- **ESLint:** clean (0 warnings, 0 errors)

---

## Changed Files: 28
`apps/web/app/globals.css`, `apps/web/lib/utils.ts`, 26 kit component files.

## Concerns
None. All 9 new token names are unique (verified non-colliding with Tailwind v4 defaults). Zero visual change to any component.
