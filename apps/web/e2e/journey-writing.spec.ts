import { expect, test } from "@playwright/test";

import { createBookViaWizard, createFirstChapterIntoEditor, loginViaApi } from "./support";

/**
 * Journey A — the core writing loop, driven end to end against the real stack:
 *
 *   dashboard → New Book wizard (real fields) → Plan board → first chapter +
 *   scene → Write editor → type → autosave reaches "Mentve" → content survives
 *   a reload → the chapter/scene show up on the Plan board.
 *
 * Assumes the CI e2e contract: web on :3000, api on :8000 (admin/changeme),
 * empty database. Auth is injected via localStorage (no login UI exists).
 */

test("core writing loop: wizard → plan board → editor → autosave 'Mentve'", async ({
  page,
  request,
}) => {
  await loginViaApi(page, request);

  // --- Dashboard → wizard → book (unique title keeps runs independent). ---
  const bookTitle = `E2E írás-próba ${Date.now()}`;
  await createBookViaWizard(page, bookTitle);

  // --- The new book's Plan board renders (empty state) → first chapter. ---
  // The CTA creates chapter #1 + scene #1 and drops us into the editor.
  const editor = await createFirstChapterIntoEditor(page);

  // --- Write: type real text into the Tiptap manuscript editor. ---
  const manuscript = "A móló kövei még őrizték az éjszaka hidegét.";
  await editor.click();
  await editor.pressSequentially(manuscript, { delay: 15 });
  await expect(editor).toContainText(manuscript);

  // --- Autosave: the StatusBar's live region must reach "Mentve". ---
  // (Debounce is 800ms + a PATCH round-trip; the default expect timeout
  // comfortably covers it. "Mentve" does not substring-match the error state
  // "Mentés sikertelen", so this cannot false-positive on a failed save.)
  await expect(
    page.getByRole("status").filter({ hasText: "Mentve" }),
  ).toBeVisible({ timeout: 15_000 });

  // --- Persistence proof: the content survives a full reload. ---
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Kézirat szerkesztő" }),
  ).toContainText(manuscript);

  // --- Plan board reflects the created structure. ---
  await page.getByRole("button", { name: "Terv" }).click();
  await page.waitForURL(/\/konyv\/[^/]+\/terv/);
  await expect(page.getByText("1. fejezet").first()).toBeVisible();
  await expect(page.getByText("1. jelenet").first()).toBeVisible();
});
