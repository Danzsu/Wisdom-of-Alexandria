import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config (the first end-to-end layer).
 *
 * Tests run against an ALREADY-RUNNING web app at `E2E_BASE_URL` (default
 * :3000). The full stack (web + api + ai + postgres + redis) is provided by the
 * caller — `docker compose up` locally, or the CI `e2e` job which launches the
 * services as separate processes. They run as separate processes/containers, so
 * the apps/api + apps/ai shared `app` package name never collides here (that
 * only matters inside a single Python process).
 *
 * `@playwright/test` is NOT a committed dependency and `e2e/**` is excluded
 * from tsc + vitest. The CI e2e job installs it runner-locally (`pnpm add -D`,
 * nothing committed) and runs `pnpm exec playwright` — `pnpm dlx` cannot work
 * here, because this config's own `import "@playwright/test"` resolves from
 * apps/web upward and the dlx sandbox is never on that path.
 */
export default defineConfig({
  testDir: "./e2e",
  // CI is the source of truth for E2E; keep it strict there, lenient locally.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Local convenience only: when not in CI, Playwright boots (or reuses) the web
  // dev server itself so `playwright test` works without a manually pre-started
  // stack. In CI this is `undefined` — the `e2e` job boots web + api + ai as
  // separate processes itself (each resolves its own local `app` package, so the
  // shared package name never collides). The smoke spec is backend-DATA-
  // independent, so the web server alone is enough to drive it locally.
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
