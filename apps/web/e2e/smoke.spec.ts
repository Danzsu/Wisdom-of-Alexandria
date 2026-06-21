import { expect, test } from "@playwright/test";

/**
 * Smoke E2E — the first end-to-end signal across the running web + api + ai
 * stack. Intentionally backend-DATA-independent: it asserts the app boots, the
 * root route redirects to the projects picker, and the shell renders (locale +
 * theme), NOT any seeded data. Deeper journeys (auth → create project →
 * generate → approve) build on this foundation.
 */
test("root redirects to the projects picker and the app shell renders", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/projekt/);
  // The root layout's <html lang="hu" data-woa="light"> is present once the app
  // has booted (locale + theme), independent of any backend data/auth state.
  await expect(page.locator("html")).toHaveAttribute("lang", "hu");
  await expect(page.locator("html")).toHaveAttribute("data-woa", "light");
});
