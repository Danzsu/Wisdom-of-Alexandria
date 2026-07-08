import { expect, test } from "@playwright/test";

import {
  createBookViaWizard,
  createFirstChapterIntoEditor,
  gotoPlanBoardViaBreadcrumb,
  loginViaApi,
  typeAndAwaitAutosave,
} from "./support";

/**
 * Journey A — the core writing loop, driven end to end against the real stack:
 *
 *   dashboard → New Book wizard (real fields) → Plan board → first chapter +
 *   scene → Write editor → type → the autosave PATCH lands (+ "Mentve") →
 *   content survives a reload → breadcrumb back to the Plan board, which
 *   shows the created chapter/scene.
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

  // --- Write: type into the Tiptap editor and wait for the REAL save. ---
  // The StatusBar's idle state already reads "Mentve", so asserting that text
  // alone is meaningless — the first CI run raced page.reload() ahead of the
  // 800ms autosave debounce and lost the content. The helper types (focus-
  // gated click + pressSequentially), then awaits the scene PATCH ok()
  // response before trusting the contentinfo-scoped "Mentve".
  const manuscript = "A móló kövei még őrizték az éjszaka hidegét.";
  await typeAndAwaitAutosave(page, editor, manuscript);

  // --- Persistence proof: the content survives a full reload. ---
  // Post-reload the app re-hydrates and the book-tree query must resolve
  // before the editor mounts with the saved content — give it CI headroom.
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Kézirat szerkesztő" }),
  ).toContainText(manuscript, { timeout: 15_000 });

  // --- Plan board reflects the created structure. ---
  // On the Write route the left pane is the chapter tree — the icon rail (and
  // any button named "Terv") does not exist here; the TopBar breadcrumb is the
  // route's real Plan affordance.
  await gotoPlanBoardViaBreadcrumb(page);
  await expect(page.getByText("1. fejezet").first()).toBeVisible();
  await expect(page.getByText("1. jelenet").first()).toBeVisible();
});
