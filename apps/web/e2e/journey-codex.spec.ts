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

  // --- Open the create modal. A fresh book's Codex is empty, so either the
  // empty-state CTA ("Új bejegyzés") or the sidebar add button ("Új") works —
  // take whichever renders first. ---
  await page
    .getByRole("button", { name: /^(Új bejegyzés|Új)$/ })
    .first()
    .click();

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
