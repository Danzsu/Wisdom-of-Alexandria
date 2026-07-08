import { expect, test } from "@playwright/test";

import {
  createBookViaWizard,
  createFirstChapterIntoEditor,
  gotoPlanBoardViaBreadcrumb,
  loginViaApi,
  typeAndAwaitAutosave,
} from "./support";

/**
 * Journey C — Markdown export downloads a real file:
 *
 *   create a book → first chapter + scene → write a line (await the autosave
 *   PATCH so the export has content) → breadcrumb to the Plan board → icon
 *   rail "Export" → Markdown (default format) → "Exportálás" → a browser
 *   download event fires with an .md filename.
 *
 * Same CI contract as the other journeys (empty DB, admin/changeme).
 */

test("export: the Markdown export triggers a real .md download", async ({
  page,
  request,
}) => {
  await loginViaApi(page, request);

  const bookId = await createBookViaWizard(page, `E2E export-próba ${Date.now()}`);

  // Give the book real content so the export is not an empty shell. The
  // helper awaits the autosave PATCH ok() — the idle StatusBar already reads
  // "Mentve", so the text alone proves nothing about persistence.
  const editor = await createFirstChapterIntoEditor(page);
  await typeAndAwaitAutosave(page, editor, "Az apály aznap egy órával korábban jött.");

  // --- Export screen via the icon rail. ---
  // The rail only renders on non-Write book routes (on `iras` the left pane is
  // the chapter tree), so first return to the Plan board via the TopBar
  // breadcrumb, then click the rail's Export button (aria-label "Export").
  await gotoPlanBoardViaBreadcrumb(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.waitForURL(new RegExp(`/konyv/${bookId}/export`));

  // Markdown is the pre-selected format card (aria-pressed button).
  await expect(
    page.getByRole("button", { name: /Markdown/ }),
  ).toHaveAttribute("aria-pressed", "true");

  // --- Trigger the export and capture the real browser download. ---
  // The screen's "Exportálás" tab is role="tab" (kit Tab), so the button query
  // uniquely matches the primary CTA. The download itself is an anchor+blob
  // click (downloadBlob in lib/api/export-hooks), which fires a real
  // Playwright download event.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportálás", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
});
