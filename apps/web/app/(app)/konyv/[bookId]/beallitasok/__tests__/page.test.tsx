import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { FAROSZ_BOOK } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";
import { resetBookStore } from "@/test/msw/handlers";
import type { BookUpdate } from "@/lib/api/types";

const base = `${API_BASE_URL}/api/v1`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => `/konyv/${FAROSZ_BOOK.id}/beallitasok`,
  useParams: () => ({ bookId: FAROSZ_BOOK.id }),
}));

import BeallitasokPage from "../page";

function renderSettings() {
  return render(
    <Providers>
      <BeallitasokPage />
    </Providers>,
  );
}

describe("Book settings page", () => {
  beforeEach(() => {
    resetBookStore();
  });
  afterEach(() => vi.clearAllMocks());

  it("renders the author field on the Könyv tab (default)", async () => {
    renderSettings();
    // The metadata "Szerző" is distinct from the cover panel's "Szerző a
    // borítón", so the label is unambiguous.
    expect(
      await screen.findByLabelText(hu.books.authorLabel),
    ).toBeInTheDocument();
  });

  it("edits the book author", async () => {
    const user = userEvent.setup();
    const patched: BookUpdate[] = [];
    server.use(
      http.patch(
        `${base}/projects/:projectId/books/:bookId`,
        async ({ request }) => {
          const body = (await request.json()) as BookUpdate;
          patched.push(body);
          return HttpResponse.json({ ...FAROSZ_BOOK, ...body });
        },
      ),
    );
    renderSettings();
    const metadataAuthorField = await screen.findByLabelText(
      hu.books.authorLabel,
    );
    await user.clear(metadataAuthorField);
    await user.type(metadataAuthorField, "Rácz Dániel");
    await user.click(screen.getByRole("button", { name: hu.books.save }));
    await waitFor(() =>
      expect(patched.at(-1)).toMatchObject({ author: "Rácz Dániel" }),
    );
  });

  it("shows the cover generator section on the Könyv tab (default)", async () => {
    renderSettings();
    expect(await screen.findByText(hu.covers.title)).toBeInTheDocument();
    expect(await screen.findByLabelText(hu.covers.artStyleLabel)).toBeInTheDocument();
  });

  it("switching to AI / Szolgáltatók tab renders the provider hub", async () => {
    const user = userEvent.setup();
    renderSettings();

    // The segmented control is a radiogroup; select the providers tab.
    const providersTab = await screen.findByRole("radio", {
      name: hu.books.tabProviders,
    });
    await user.click(providersTab);

    // SettingsHub renders its h1 as hu.settings.title ("Beállítások").
    expect(
      await screen.findByRole("heading", { name: hu.settings.title }),
    ).toBeInTheDocument();
  });
});
