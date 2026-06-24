import { expect, test } from "@playwright/test";

/**
 * Smoke E2E — the first end-to-end signal across the running web + api + ai
 * stack. Intentionally backend-DATA-independent: it asserts the app boots, the
 * public landing renders at `/`, the root layout's locale + theme are applied,
 * and the landing CTA enters the app at `/projekt`. Deeper journeys (auth →
 * create project → generate → approve) build on this foundation.
 *
 * (DESIGN-C: `/` used to redirect straight to `/projekt`; it now serves the
 * marketing landing, and `/projekt` is reached via the "Belépés a műhelybe" CTA.)
 */
test("the landing renders at root and its CTA enters the app", async ({
  page,
}) => {
  await page.goto("/");
  // Stays on the landing (no redirect) and shows the hero headline.
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: /A regényed/ }),
  ).toBeVisible();
  // The root layout's <html lang="hu" data-woa="light"> is present once the app
  // has booted (locale + theme), independent of any backend data/auth state.
  await expect(page.locator("html")).toHaveAttribute("lang", "hu");
  await expect(page.locator("html")).toHaveAttribute("data-woa", "light");

  // The primary CTA navigates into the app at /projekt.
  await page
    .getByRole("link", { name: "Belépés a műhelybe" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/projekt/);
});
