# Task 10 Report — Radix Select primitive + replace native selects

## select.tsx API

`Select({ value, onValueChange, options: {value:string,label:string}[], placeholder?, "aria-label"?, disabled?, className? })`

Built on `@radix-ui/react-select`. Trigger: `h-9` (36px), `rounded-md`, `border-border`, `bg-surface`, focus ring `focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]`, trailing `ChevronDown` via kit `Icon`. Content: portalled, `shadow-popover`, `rounded-lg`, `border-border`, `data-[state=open]:[animation:woaToastIn_.15s_ease-out]`. Items: `role="option"` (Radix default), highlight via `data-[highlighted]`, check icon (`Check` from lucide) on selected item.

## Driving Radix Select in jsdom

`userEvent.click` works for Radix DropdownMenu but Radix Select opens on `pointerdown` and checks `e.pointerType`. Under jsdom + `@testing-library/user-event`, the reliable pattern is: `trigger.focus()` then `await userEvent.keyboard(" ")` (Space). The vitest.setup.ts already shims `hasPointerCapture`/`setPointerCapture`/`releasePointerCapture`/`scrollIntoView`. After Space opens the listbox, `screen.findByRole("option", { name })` locates the option and `userEvent.click(option)` selects it.

## Panel adoptions

**`cover-panel.tsx`**: replaced two `<select>` elements (art-style, layout) with `<Select aria-label={hu.covers.artStyleLabel/layoutLabel} ...>`. Removed now-unused `artStylePickerId`/`layoutPickerId` variables. Visual `<label>` kept for sighted users; `aria-label` on the trigger provides the accessible name.

**`image-panel.tsx`**: replaced one `<select>` (style picker) with `<Select aria-label={hu.images.styleLabel} ...>`. Same label pattern.

## Test updates

**`cover-panel.test.tsx`**: changed `findByLabelText(hu.covers.artStyleLabel/layoutLabel)` → `findByRole("combobox", { name: hu.covers.artStyleLabel/layoutLabel })`. POST body assertions unchanged.

**`image-panel.test.tsx`**: changed `findByLabelText` + `within(picker).getByText(...)` → `findByRole("combobox", { name: hu.images.styleLabel })` + `waitFor(() => expect(trigger).toHaveTextContent("Realisztikus portré"))`. Removed unused `within` import. All other assertions (generate, canonical, delete, retry, etc.) unchanged.

## Full-suite count

733 tests passed (124 test files) — up 5 from the previous 728 baseline (the 5 new `select.test.tsx` cases).

## tsc / lint

`tsc --noEmit` — clean (no errors, no output).  
`next lint` — "No ESLint warnings or errors".

## Concerns

None. The keyboard-open pattern (`focus` + Space) is reliable across jsdom versions and does not depend on pointer event internals. The `within(picker)` approach from the old native-select test was removed because Radix Select portals its listbox outside the trigger DOM subtree.
