import { expect, test } from "@playwright/test";

import { createBookViaWizard, createFirstChapterIntoEditor, loginViaApi } from "./support";

/**
 * Journey C — Markdown export downloads a real file:
 *
 *   create a book → first chapter + scene → write a line (wait for "Mentve"
 *   so the export has content) → Export screen → Markdown (default format) →
 *   "Exportálás" → a browser download event fires with an .md filename.
 *
 * Same CI contract as the other journeys (empty DB, admin/changeme).
 */

test("export: the Markdown export triggers a real .md download", async ({
  page,
  request,
}) => {
  await loginViaApi(page, request);

  const bookId = await createBookViaWizard(page, `E2E export-próba ${Date.now()}`);

  // Give the book real content so the export is not an empty shell.
  const editor = await createFirstChapterIntoEditor(page);
  await editor.click();
  await editor.pressSequentially("Az apály aznap egy órával korábban jött.", { delay: 15 });
  await expect(
    page.getByRole("status").filter({ hasText: "Mentve" }),
  ).toBeVisible({ timeout: 15_000 });

  // --- Export screen via the icon rail. ---
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.waitForURL(new RegExp(`/konyv/${bookId}/export`));

  // Markdown is the pre-selected format card (aria-pressed button).
  await expect(
    page.getByRole("button", { name: /Markdown/ }),
  ).toHaveAttribute("aria-pressed", "true");

  // --- Trigger the export and capture the real browser download. ---
  // "Exportálás" names both the screen tab and the primary CTA; the CTA sits
  // below the tab strip in DOM order, so .last() targets it either way (and
  // if the tabs expose role="tab" instead of button, .last() is a no-op).
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportálás", exact: true }).last().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
});
