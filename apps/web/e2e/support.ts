import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

/**
 * Shared helpers for the journey specs.
 *
 * Auth contract: the web app has NO login UI — `lib/api/client.ts` reads a JWT
 * from localStorage under `woa-token` and sends it as a Bearer header. The
 * journeys therefore mint the single-user admin token straight from the API
 * (the same credentials the CI e2e job boots with) and inject it BEFORE the
 * app loads via `addInitScript`.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "changeme";
/** Must match TOKEN_STORAGE_KEY in apps/web/lib/api/client.ts. */
const TOKEN_STORAGE_KEY = "woa-token";

/** Mint an admin JWT from the API and plant it in localStorage pre-load. */
export async function loginViaApi(page: Page, request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API_URL}/api/v1/auth/token`, {
    form: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  expect(response.ok(), `auth token request failed: ${response.status()}`).toBeTruthy();
  const { access_token: token } = (await response.json()) as { access_token: string };
  expect(token, "auth response carried no access_token").toBeTruthy();

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [TOKEN_STORAGE_KEY, token] as const,
  );
}

/**
 * Drive the real New Book wizard end to end from the dashboard and return the
 * created book's id (parsed from the post-create `/konyv/{id}/terv` URL).
 *
 * The wizard creates the Project AND the Book together, so this works from a
 * completely empty database. Every journey creates its own uniquely titled
 * book, keeping the specs order- and parallelism-independent on the shared DB.
 */
export async function createBookViaWizard(page: Page, title: string): Promise<string> {
  await page.goto("/projekt");

  // Both the quick-action tile and the empty-state CTA are named "Új könyv"
  // and open the same wizard — whichever is present, the first one works.
  await page.getByRole("button", { name: "Új könyv" }).first().click();

  // Step 1 — Alapadatok: the title is the only required field.
  await page.getByLabel("Cím", { exact: true }).fill(title);
  await page.getByRole("button", { name: /Tovább/ }).click();

  // Step 2 — Stílus és AI: defaults are fine.
  await page.getByRole("button", { name: /Tovább/ }).click();

  // Step 3 — Összegzés: create. Success navigates to the book's Plan board.
  await page.getByRole("button", { name: /Könyv létrehozása/ }).click();
  await page.waitForURL(/\/konyv\/[^/]+\/terv/);

  const bookId = page.url().match(/\/konyv\/([^/]+)\/terv/)?.[1];
  expect(bookId, "could not parse bookId from the plan-board URL").toBeTruthy();
  return bookId as string;
}

/**
 * From a fresh book's empty Plan board, create chapter #1 + scene #1 via the
 * "Első fejezet létrehozása" CTA (which auto-navigates into the Write editor)
 * and return the Tiptap editor locator once it is visible.
 */
export async function createFirstChapterIntoEditor(page: Page) {
  await expect(page.getByText("Még üres a könyv")).toBeVisible();
  await page.getByRole("button", { name: "Első fejezet létrehozása" }).click();
  await page.waitForURL(/\/konyv\/[^/]+\/iras\/[^/]+/);

  const editor = page.getByRole("textbox", { name: "Kézirat szerkesztő" });
  await expect(editor).toBeVisible();
  return editor;
}

/**
 * Type into the (visible) manuscript editor, then wait until the text has
 * REALLY been persisted before returning.
 *
 * Why the response waiter: the StatusBar save state INITIALIZES to "Mentve"
 * (editor-store `saveState: "saved"`), so asserting the "Mentve" text alone is
 * meaningless before a save has fired. The first journey CI run did exactly
 * that — the assertion passed instantly on the idle text and `page.reload()`
 * raced ahead of the 800ms autosave debounce, so the PATCH never fired and the
 * post-reload editor came back empty. Arming a waiter for the scene PATCH
 * BEFORE typing (the debounce fires ~800ms after the last keystroke, so the
 * waiter cannot miss it) and requiring an ok() response guarantees the content
 * reached the API; `ok()` also rides out transient failures, because the
 * autosave retry ladder re-PATCHes and the waiter resolves on the attempt
 * that lands.
 */
export async function typeAndAwaitAutosave(
  page: Page,
  editor: Locator,
  text: string,
): Promise<void> {
  // The Write route is /konyv/{bookId}/iras/{sceneId} — the autosave PATCHes
  // /chapters/{chapterId}/scenes/{sceneId}, so the scene id anchors the waiter.
  const sceneId = page.url().match(/\/iras\/([^/?#]+)/)?.[1];
  expect(sceneId, "typeAndAwaitAutosave must run on a Write route").toBeTruthy();

  // Focus via a real click (places the ProseMirror caret), gated on focus
  // actually landing in the contenteditable before any key is sent.
  await editor.click();
  await expect(editor).toBeFocused();

  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith(`/scenes/${sceneId}`) &&
      response.ok(),
  );

  await editor.pressSequentially(text, { delay: 15 });
  await expect(editor).toContainText(text);
  await saved;

  // Scoped to the contentinfo landmark (the StatusBar <footer>): the editor
  // area renders a second role="status" inside <main>, so an unscoped
  // getByRole("status") is a strict-mode violation. After the awaited PATCH
  // this text reflects a real completed save, not the idle default.
  await expect(
    page
      .getByRole("contentinfo")
      .getByRole("status")
      .filter({ hasText: "Mentve" }),
  ).toBeVisible();
}

/**
 * From the Write route, return to the Plan board via the TopBar's centered
 * scene breadcrumb — the ONLY Plan affordance there: on `iras` the left pane
 * is the chapter tree, so the icon rail (with its Terv/Codex/Export buttons)
 * does not exist on this route. The breadcrumb's copy is the static prototype
 * text "II. fejezet › 3. jelenet — Rejtett jelek" (hu.topbar.breadcrumb*), so
 * match on its distinctive tail rather than the full punctuation-heavy name.
 */
export async function gotoPlanBoardViaBreadcrumb(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Rejtett jelek" }).click();
  await page.waitForURL(/\/konyv\/[^/]+\/terv/);
}
