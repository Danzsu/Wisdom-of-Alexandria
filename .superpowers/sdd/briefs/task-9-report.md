# Task 9 Report — Mount CoverPanel in Book Settings "Könyv" Tab

## STATUS: DONE

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/(app)/konyv/[bookId]/beallitasok/book-tab.tsx` | Added `CoverPanel` import + rendered it below the metadata form, separated by `<hr>`, guarded by `bookQuery.data ?` to satisfy TypeScript strict null checks |
| `apps/web/app/(app)/konyv/[bookId]/beallitasok/__tests__/page.test.tsx` | Added new test `"shows the cover generator section on the Könyv tab (default)"` asserting `hu.covers.title` heading ("Borító") and `hu.covers.artStyleLabel` picker ("Stílus") render. Updated two pre-existing author-field tests that broke because `hu.books.authorLabel` ("Szerző") is identical to `hu.covers.authorLabel` ("Szerző") — both now use `findAllByLabelText` and index `[0]` (the metadata form field, first in DOM) |

## How book-tab.tsx exposes the book props

`BookTab` uses `useResolvedBook(bookId)` (from `lib/api/export-hooks`) which returns a TanStack Query result. The book object is in `bookQuery.data`. The component already had local state seeded from `bookQuery.data.{title,genre,author}`. The `CoverPanel` is rendered conditionally on `bookQuery.data` being truthy — this is the same point in the component tree where the metadata form is rendered (after the loading/error early-returns), so `bookQuery.data` is always populated when the panel renders.

Props passed: `bookId={bookQuery.data.id}`, `bookTitle={bookQuery.data.title}`, `bookAuthor={bookQuery.data.author ?? null}`.

## Test Added

```tsx
it("shows the cover generator section on the Könyv tab (default)", async () => {
  renderSettings();
  expect(await screen.findByText(hu.covers.title)).toBeInTheDocument();
  expect(await screen.findByLabelText(hu.covers.artStyleLabel)).toBeInTheDocument();
});
```

TDD cycle: added test → confirmed FAIL (no "Borító" text, no "Stílus" picker) → mounted `CoverPanel` → confirmed PASS.

## Commands + Results

```
npx vitest run "beallitasok"   →  4 passed (4)        [after mount]
npx tsc --noEmit               →  clean
npx next lint                  →  No ESLint warnings or errors
npx vitest run                 →  684 passed (684), 119 test files
```

## Concerns

- **Duplicate "Szerző" label**: `hu.books.authorLabel` and `hu.covers.authorLabel` are both "Szerző". This causes two inputs with the same accessible label on the page. The two pre-existing tests were updated to use `findAllByLabelText(...)[0]` to select the metadata form's field specifically. A future improvement would be to differentiate the labels (e.g. `hu.covers.authorLabel = "Szerző a borítón"`) but that would require changing the cover panel component and its own tests — out of scope for Task 9.
- **`<hr>` separator**: A plain `<hr className="my-8 border-border" />` was used as the visual separator between the metadata form and the cover section, consistent with the file's Tailwind styling. If the design calls for a different separator (e.g. `SectionDivider` component), that's a UI polish task.
- No new MSW handlers were needed — `/ai/covers/styles`, `/ai/covers/layouts`, `/ai/images`, and `/ai/media/:id` handlers were all already registered from Task 7.
