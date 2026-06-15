import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  createProviderInStore,
  resetProviderStore,
} from "@/test/msw/handlers";
import { PROVIDER_GEMINI, PROVIDER_OLLAMA } from "@/test/msw/fixtures";
import { CloudSubpage } from "../cloud-subpage";

const base = `${API_BASE_URL}/api/v1`;

function renderCloud() {
  return render(
    <Providers>
      <CloudSubpage onBack={vi.fn()} />
    </Providers>,
  );
}

describe("CloudSubpage — real provider/API-key configuration", () => {
  beforeEach(() => resetProviderStore());

  it("lists providers from the API, showing the MASKED key (never a raw key)", async () => {
    renderCloud();

    expect(await screen.findByText(PROVIDER_GEMINI.label)).toBeInTheDocument();
    expect(screen.getByText(PROVIDER_OLLAMA.label)).toBeInTheDocument();

    // The masked preview is shown; a raw key never is. The mask is the only
    // key-derived string the read contract carries.
    expect(
      screen.getByText(new RegExp(PROVIDER_GEMINI.api_key_masked as string)),
    ).toBeInTheDocument();
    // Defensive: the masked value starts with bullets, never plaintext.
    expect(PROVIDER_GEMINI.api_key_masked).toMatch(/^•{4}/);
  });

  it("shows the loading state then the list", async () => {
    renderCloud();
    expect(screen.getByText("Providerek betöltése…")).toBeInTheDocument();
    expect(await screen.findByText(PROVIDER_GEMINI.label)).toBeInTheDocument();
  });

  it("surfaces an API error (no swallow)", async () => {
    server.use(
      http.get(`${base}/providers`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderCloud();
    expect(
      await screen.findByText("Nem sikerült betölteni a providereket."),
    ).toBeInTheDocument();
  });

  it("renders the empty state when there are no providers", async () => {
    server.use(http.get(`${base}/providers`, () => HttpResponse.json([])));
    renderCloud();
    expect(
      await screen.findByText("Még nincs felhő-provider beállítva."),
    ).toBeInTheDocument();
  });

  it("validates the add form (cloud type requires a key) then POSTs and the provider appears", async () => {
    const user = userEvent.setup();

    let captured: Record<string, unknown> | null = null;
    server.use(
      http.post(`${base}/providers`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        // Also persist to the store so the list refetch shows the new provider.
        const created = createProviderInStore(
          captured as Parameters<typeof createProviderInStore>[0],
        );
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    renderCloud();
    await screen.findByText(PROVIDER_GEMINI.label);

    await user.click(
      screen.getByRole("button", { name: "Provider hozzáadása" }),
    );

    // Fill the label but leave the key blank → cloud key required.
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Megnevezés"),
      "OpenAI munka",
    );
    // Default type is Gemini (a cloud type) → submit must block on the key.
    await user.click(within(dialog).getByRole("button", { name: "Hozzáadás" }));
    expect(
      await within(dialog).findByText(
        "Felhő-providerhez API-kulcs szükséges.",
      ),
    ).toBeInTheDocument();
    expect(captured).toBeNull();

    // Provide a key and submit.
    await user.type(within(dialog).getByLabelText("API-kulcs"), "sk-secret-1234");
    await user.click(within(dialog).getByRole("button", { name: "Hozzáadás" }));

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured).toMatchObject({
      type: "gemini",
      label: "OpenAI munka",
      api_key: "sk-secret-1234",
      enabled: true,
    });
    // The new provider shows up in the list (its masked key, not the raw key).
    expect(await screen.findByText("OpenAI munka")).toBeInTheDocument();
    expect(screen.queryByText("sk-secret-1234")).not.toBeInTheDocument();
  });

  it("edit with a BLANK key OMITS api_key (keeps the stored key)", async () => {
    const user = userEvent.setup();

    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${base}/providers/:providerId`, async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          ...PROVIDER_GEMINI,
          label: (patchBody.label as string) ?? PROVIDER_GEMINI.label,
        });
      }),
    );

    renderCloud();
    await screen.findByText(PROVIDER_GEMINI.label);

    await user.click(
      screen.getByRole("button", {
        name: `${PROVIDER_GEMINI.label} szerkesztése`,
      }),
    );

    const dialog = await screen.findByRole("dialog");
    const labelInput = within(dialog).getByLabelText("Megnevezés");
    await user.clear(labelInput);
    await user.type(labelInput, "Gemini (átnevezve)");
    // Leave the API-kulcs field BLANK → api_key must be omitted.
    await user.click(within(dialog).getByRole("button", { name: "Mentés" }));

    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(patchBody).toMatchObject({ label: "Gemini (átnevezve)" });
    expect(patchBody).not.toHaveProperty("api_key");
  });

  it("edit with a NEW key sends api_key", async () => {
    const user = userEvent.setup();

    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${base}/providers/:providerId`, async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...PROVIDER_GEMINI });
      }),
    );

    renderCloud();
    await screen.findByText(PROVIDER_GEMINI.label);

    await user.click(
      screen.getByRole("button", {
        name: `${PROVIDER_GEMINI.label} szerkesztése`,
      }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("API-kulcs"),
      "sk-rotated-9999",
    );
    await user.click(within(dialog).getByRole("button", { name: "Mentés" }));

    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(patchBody).toMatchObject({ api_key: "sk-rotated-9999" });
  });

  it("deletes a provider through the confirm dialog (DELETE)", async () => {
    const user = userEvent.setup();

    let deleted = false;
    server.use(
      http.delete(`${base}/providers/:providerId`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderCloud();
    await screen.findByText(PROVIDER_GEMINI.label);

    await user.click(
      screen.getByRole("button", {
        name: `${PROVIDER_GEMINI.label} törlése`,
      }),
    );

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Törlés" }));

    await waitFor(() => expect(deleted).toBe(true));
  });

  it("runs the connection test and shows an OK badge", async () => {
    const user = userEvent.setup();
    renderCloud();

    const card = (await screen.findByText(PROVIDER_GEMINI.label)).closest(
      "div.rounded-xl",
    ) as HTMLElement;
    await user.click(
      within(card).getByRole("button", { name: "Kapcsolat tesztelése" }),
    );

    expect(await screen.findByText("Kapcsolat rendben")).toBeInTheDocument();
  });

  it("shows a FAIL badge when the test returns ok:false", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${base}/providers/:providerId/test`, () =>
        HttpResponse.json({ ok: false, detail: "Hiányzó kulcs." }),
      ),
    );
    renderCloud();

    const card = (await screen.findByText(PROVIDER_GEMINI.label)).closest(
      "div.rounded-xl",
    ) as HTMLElement;
    await user.click(
      within(card).getByRole("button", { name: "Kapcsolat tesztelése" }),
    );

    expect(await screen.findByText("Kapcsolat sikertelen")).toBeInTheDocument();
  });
});
