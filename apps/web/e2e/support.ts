import { expect, type APIRequestContext, type Page } from "@playwright/test";

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
