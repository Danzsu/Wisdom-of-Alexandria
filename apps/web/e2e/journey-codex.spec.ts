import { expect, test } from "@playwright/test";

import { createBookViaWizard, loginViaApi } from "./support";

/**
 * Journey B — the Codex loop against the real stack:
 *
 *   create a book → Codex screen → create a character entry through the
 *   two-step NewCodexModal (type picker → form) → it appears in the sidebar
 *   list + auto-selected detail → add an alias in the detail's Részletek tab →
 *   everything survives a reload.
 *
 * Same CI contract as Journey A (empty DB, admin/changeme, no login UI).
 */

test("codex: create an entry via the modal, then add an alias in the detail", async ({
  page,
  request,
}) => {
  await loginViaApi(page, request);

  // Each journey owns its book — independent of other specs on the shared DB.
  const bookId = await createBookViaWizard(page, `E2E codex-próba ${Date.now()}`);

  // --- Codex screen (icon-rail button carries aria-label "Codex"). ---
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await page.waitForURL(new RegExp(`/konyv/${bookId}/codex`));

  // --- Wait for the Codex screen to settle. A fresh book's codex is empty,
  // so the MAIN area shows the (CTA-less) empty state; asserting it first
  // guarantees the route transition finished and the codex query resolved
  // before we click anything (an eager click here used to be intercepted by
  // the main-area empty-state container mid-transition). ---
  await expect(
    page.getByRole("main").getByText("Még üres a Codex"),
  ).toBeVisible();

  // --- Open the create modal from the Codex SIDEBAR (the only navigation
  // landmark named "Codex"; the main empty state has no CTA, so the sidebar
  // is the only create path). With an empty list the sidebar renders an
  // EmptyState whose "Új bejegyzés" CTA only mounts after its own list query
  // resolves — waiting for it doubles as a sidebar-readiness gate. ---
  const codexSidebar = page.getByRole("navigation", { name: "Codex" });
  const createCta = codexSidebar.getByRole("button", {
    name: "Új bejegyzés",
    exact: true,
  });
  await expect(createCta).toBeVisible();
  await createCta.click();

  // --- Step 1: type picker → Karakter. ---
  // The card's accessible name is its label + hint text, so anchor on the
  // label prefix (^Karakter) rather than an exact match.
  await expect(page.getByText("Válaszd ki a bejegyzés típusát:")).toBeVisible();
  await page.getByRole("button", { name: /^Karakter/ }).click();

  // --- Step 2: the form. Name is required; aliases are comma-separated. ---
  const entryName = "Áron mester";
  await page.getByLabel("Név", { exact: true }).fill(entryName);
  await page.getByLabel("Álnevek", { exact: true }).fill("a toronyőr");
  await page
    .getByLabel("Leírás", { exact: true })
    .fill("A dagálykönyvtár idős gondnoka, aki többet tud a kilencedik szintről, mint bevallja.");
  await page.getByRole("button", { name: "Bejegyzés létrehozása" }).click();

  // --- Created: the modal closes, the entry lands in the sidebar list and is
  // auto-selected (the detail's editable name field carries its name). ---
  await expect(page.getByText("Új Codex-bejegyzés létrehozva")).toBeVisible();
  await expect(page.getByLabel("Bejegyzés neve")).toHaveValue(entryName);
  await expect(page.getByText(entryName).first()).toBeVisible();

  // --- Add an alias in the Részletek tab (commit = Enter; no add button). ---
  const aliasInput = page.getByLabel("Álnevek / Becenevek");
  await aliasInput.fill("az öreg");
  await aliasInput.press("Enter");
  await expect(
    page.getByRole("button", { name: "az öreg eltávolítása" }),
  ).toBeVisible();

  // --- Persistence proof: entry + both aliases survive a reload. ---
  await page.reload();
  await expect(page.getByLabel("Bejegyzés neve")).toHaveValue(entryName);
  await expect(
    page.getByRole("button", { name: "a toronyőr eltávolítása" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "az öreg eltávolítása" }),
  ).toBeVisible();
});
