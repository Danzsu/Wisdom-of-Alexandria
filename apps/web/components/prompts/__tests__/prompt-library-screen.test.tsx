import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { hu } from "@/lib/i18n/hu";

// The screen lives under konyv/[bookId] but does not consume bookId; mock the
// router hook anyway so it behaves like the other book-scoped screens.
const params: Record<string, string | undefined> = { bookId: "book-1" };
vi.mock("next/navigation", () => ({
  useParams: () => params,
}));

import { PromptLibraryScreen } from "../prompt-library-screen";

const base = `${API_BASE_URL}/api/v1`;

// The six builtin names seeded by the backend (mirrored in the MSW store).
const BUILTIN_NAMES = [
  "Folytatás — alap",
  "Átírás — irodalmibb",
  "Érzéki leírás",
  "Párbeszéd természetesítés",
  "Ötletelés — fordulatok",
  "Magyar nyelvi ellenőrzés",
];

function renderScreen() {
  return render(
    <Providers>
      <PromptLibraryScreen />
    </Providers>,
  );
}

describe("PromptLibraryScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and renders the six seeded builtins", async () => {
    renderScreen();
    for (const name of BUILTIN_NAMES) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
  });

  it("renders the header copy + the 'Új prompt' action", async () => {
    renderScreen();
    expect(
      screen.getByRole("heading", { name: hu.promptLibrary.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(hu.promptLibrary.subtitle)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: hu.promptLibrary.newPrompt }),
    ).toBeInTheDocument();
    // Wait for the list to settle so no act() warning trails the test.
    await screen.findByText(BUILTIN_NAMES[0]);
  });

  it("shows an error state with a retry when the list fails", async () => {
    server.use(
      http.get(`${base}/prompt-templates`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderScreen();
    expect(
      await screen.findByText(hu.promptLibrary.loadError),
    ).toBeInTheDocument();
    // ErrorState supplies its own retry label (`hu.common.retry`).
    expect(
      screen.getByRole("button", { name: hu.common.retry }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the API returns no templates", async () => {
    server.use(
      http.get(`${base}/prompt-templates`, () => HttpResponse.json([])),
    );
    renderScreen();
    expect(await screen.findByText(hu.promptLibrary.empty)).toBeInTheDocument();
  });

  it("opens a read-only detail modal showing THAT prompt's body", async () => {
    // Distinctive substring of the Érzéki leírás body — unique across builtins.
    const distinctive = "látás, hang, tapintás, szag, íz, metafora";
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      await screen.findByRole("button", { name: /Érzéki leírás/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(distinctive);
    expect(dialog).toHaveTextContent("Érzéki leírás");
    expect(dialog).toHaveTextContent(hu.promptLibrary.usesLabel("0"));
  });

  it("does NOT show another prompt's body before its card is clicked", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Folytatás — alap");
    expect(
      screen.queryByText(/Ne zárd le a jelenetet/),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Folytatás — alap/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Ne zárd le a jelenetet");
  });

  it("'Új prompt' creates a template via POST and the list refetches", async () => {
    const posted: { name: string }[] = [];
    server.use(
      http.post(`${base}/prompt-templates`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        posted.push({ name: body.name });
        return HttpResponse.json(
          {
            id: "user-created",
            name: body.name,
            category: "Egyéni",
            description: "Új leírás",
            body: "Új törzs {x}",
            uses: 0,
            is_builtin: false,
            icon_key: null,
            created_at: "2026-06-25T11:00:00Z",
            updated_at: "2026-06-25T11:00:00Z",
          },
          { status: 201 },
        );
      }),
      // After create, the list refetch includes the new user template.
      http.get(`${base}/prompt-templates`, () =>
        HttpResponse.json([
          {
            id: "user-created",
            name: "Saját prompt",
            category: "Egyéni",
            description: "Új leírás",
            body: "Új törzs {x}",
            uses: 0,
            is_builtin: false,
            icon_key: null,
            created_at: "2026-06-25T11:00:00Z",
            updated_at: "2026-06-25T11:00:00Z",
          },
        ]),
      ),
    );

    const user = userEvent.setup();
    renderScreen();

    await user.click(
      screen.getByRole("button", { name: hu.promptLibrary.newPrompt }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(hu.promptLibrary.fieldName),
      "Saját prompt",
    );
    await user.type(
      within(dialog).getByLabelText(hu.promptLibrary.fieldCategory),
      "Egyéni",
    );
    await user.type(
      within(dialog).getByLabelText(hu.promptLibrary.fieldBody),
      "Csináld ezt: {valami}.",
    );
    await user.click(
      within(dialog).getByRole("button", { name: hu.promptLibrary.submit }),
    );

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].name).toBe("Saját prompt");
    // The refetched list shows the new user template.
    expect(await screen.findByText("Saját prompt")).toBeInTheDocument();
  });

  it("builtin cards render NO delete button", async () => {
    renderScreen();
    await screen.findByText("Érzéki leírás");
    // No builtin exposes a "Törlés" affordance (all seeded cards are builtin).
    expect(
      screen.queryByRole("button", { name: /Törlés/ }),
    ).toBeNull();
  });

  it("user cards expose delete; clicking it fires DELETE and the card disappears", async () => {
    const userTemplate = {
      id: "user-1",
      name: "Saját prompt",
      category: "Egyéni",
      description: "Felhasználói leírás",
      body: "Csináld ezt: {x}",
      uses: 3,
      is_builtin: false,
      icon_key: null,
      created_at: "2026-06-25T11:00:00Z",
      updated_at: "2026-06-25T11:00:00Z",
    };
    const deleted: string[] = [];
    let listCall = 0;
    server.use(
      // First list call returns the user template; after delete the refetch is empty.
      http.get(`${base}/prompt-templates`, () => {
        listCall += 1;
        return HttpResponse.json(listCall === 1 ? [userTemplate] : []);
      }),
      http.delete(`${base}/prompt-templates/:id`, ({ params }) => {
        deleted.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderScreen();
    expect(await screen.findByText("Saját prompt")).toBeInTheDocument();

    const deleteBtn = screen.getByRole("button", {
      name: `${hu.promptLibrary.deleteLabel}: Saját prompt`,
    });
    await user.click(deleteBtn);

    await waitFor(() => expect(deleted).toEqual(["user-1"]));
    // After the invalidate-driven refetch (now empty), the card is gone and the
    // empty state shows.
    await waitFor(() =>
      expect(screen.queryByText("Saját prompt")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(hu.promptLibrary.empty)).toBeInTheDocument();
  });

  it("has no a11y violations on the loaded screen", async () => {
    const { container } = renderScreen();
    await screen.findByText(BUILTIN_NAMES[0]);
    await expectNoA11yViolations(container);
  });

  it("has no a11y violations with the detail modal open", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(
      await screen.findByRole("button", { name: /Érzéki leírás/ }),
    );
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await expectNoA11yViolations(document);
  });
});
