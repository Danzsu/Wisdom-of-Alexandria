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

  // ---------------------------------------------------------------------------
  // Inline edit (PATCH) — user templates only.
  // ---------------------------------------------------------------------------

  /** A single user template the edit suite mounts via a one-shot list handler. */
  const editableTemplate = {
    id: "user-edit",
    name: "Szerkeszthető prompt",
    category: "Egyéni",
    description: "Régi leírás",
    body: "Régi törzs {x}",
    uses: 5,
    is_builtin: false,
    icon_key: null,
    created_at: "2026-06-25T11:00:00Z",
    updated_at: "2026-06-25T11:00:00Z",
  };

  it("user cards expose an edit button; builtin cards do NOT", async () => {
    server.use(
      http.get(`${base}/prompt-templates`, () =>
        HttpResponse.json([editableTemplate]),
      ),
    );
    renderScreen();
    await screen.findByText("Szerkeszthető prompt");

    // The user card has an edit affordance...
    expect(
      screen.getByRole("button", {
        name: `${hu.promptLibrary.editLabel}: Szerkeszthető prompt`,
      }),
    ).toBeInTheDocument();
    // ...and no builtin name renders, so no builtin edit button exists.
    expect(
      screen.queryByRole("button", {
        name: `${hu.promptLibrary.editLabel}: Érzéki leírás`,
      }),
    ).toBeNull();
  });

  it("builtin cards expose NO edit button", async () => {
    renderScreen();
    await screen.findByText("Érzéki leírás");
    // All seeded cards are builtin → no edit affordance anywhere.
    expect(
      screen.queryByRole("button", {
        name: new RegExp(`^${hu.promptLibrary.editLabel}:`),
      }),
    ).toBeNull();
  });

  it("clicking edit opens the modal PREFILLED with the template's values", async () => {
    server.use(
      http.get(`${base}/prompt-templates`, () =>
        HttpResponse.json([editableTemplate]),
      ),
    );
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Szerkeszthető prompt");

    await user.click(
      screen.getByRole("button", {
        name: `${hu.promptLibrary.editLabel}: Szerkeszthető prompt`,
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(hu.promptLibrary.editTitle);
    // Inputs are PREFILLED (not empty) with the existing values.
    expect(within(dialog).getByLabelText(hu.promptLibrary.fieldName)).toHaveValue(
      "Szerkeszthető prompt",
    );
    expect(
      within(dialog).getByLabelText(hu.promptLibrary.fieldCategory),
    ).toHaveValue("Egyéni");
    expect(
      within(dialog).getByLabelText(hu.promptLibrary.fieldDescription),
    ).toHaveValue("Régi leírás");
    expect(within(dialog).getByLabelText(hu.promptLibrary.fieldBody)).toHaveValue(
      "Régi törzs {x}",
    );
  });

  it("clicking edit does NOT open the read-only detail modal", async () => {
    server.use(
      http.get(`${base}/prompt-templates`, () =>
        HttpResponse.json([editableTemplate]),
      ),
    );
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Szerkeszthető prompt");

    await user.click(
      screen.getByRole("button", {
        name: `${hu.promptLibrary.editLabel}: Szerkeszthető prompt`,
      }),
    );
    const dialog = await screen.findByRole("dialog");
    // The edit modal — not the read-only detail (which has the "Sablon" heading
    // as a section AND would show the body in a <pre>). The edit dialog has the
    // editable form: assert the edit title is present (proves it's the editor).
    expect(dialog).toHaveTextContent(hu.promptLibrary.editTitle);
    expect(
      within(dialog).getByLabelText(hu.promptLibrary.fieldName),
    ).toBeInTheDocument();
  });

  it("editing a field + submitting fires PATCH with the changed payload and the list reflects it", async () => {
    const patched: { id: string; body: Record<string, unknown> }[] = [];
    let listCall = 0;
    server.use(
      http.get(`${base}/prompt-templates`, () => {
        listCall += 1;
        // After the PATCH-driven invalidate, the refetch returns the new name.
        return HttpResponse.json(
          listCall === 1
            ? [editableTemplate]
            : [{ ...editableTemplate, name: "Frissített prompt" }],
        );
      }),
      http.patch(`${base}/prompt-templates/:id`, async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patched.push({ id: String(params.id), body });
        return HttpResponse.json({ ...editableTemplate, ...body });
      }),
    );

    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Szerkeszthető prompt");

    await user.click(
      screen.getByRole("button", {
        name: `${hu.promptLibrary.editLabel}: Szerkeszthető prompt`,
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByLabelText(hu.promptLibrary.fieldName);
    await user.clear(nameInput);
    await user.type(nameInput, "Frissített prompt");
    await user.click(
      within(dialog).getByRole("button", { name: hu.promptLibrary.editSubmit }),
    );

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].id).toBe("user-edit");
    expect(patched[0].body.name).toBe("Frissített prompt");
    // The refetched list reflects the change.
    expect(await screen.findByText("Frissített prompt")).toBeInTheDocument();
  });

  it("edit error path shows an error toast (not success)", async () => {
    server.use(
      http.get(`${base}/prompt-templates`, () =>
        HttpResponse.json([editableTemplate]),
      ),
      http.patch(`${base}/prompt-templates/:id`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Szerkeszthető prompt");

    await user.click(
      screen.getByRole("button", {
        name: `${hu.promptLibrary.editLabel}: Szerkeszthető prompt`,
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByLabelText(hu.promptLibrary.fieldName);
    await user.clear(nameInput);
    await user.type(nameInput, "Hibás mentés");
    await user.click(
      within(dialog).getByRole("button", { name: hu.promptLibrary.editSubmit }),
    );

    expect(
      await screen.findByText(hu.promptLibrary.updateError),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(hu.promptLibrary.updateSuccess),
    ).not.toBeInTheDocument();
  });

  it("has no a11y violations with the edit modal open", async () => {
    server.use(
      http.get(`${base}/prompt-templates`, () =>
        HttpResponse.json([editableTemplate]),
      ),
    );
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Szerkeszthető prompt");

    await user.click(
      screen.getByRole("button", {
        name: `${hu.promptLibrary.editLabel}: Szerkeszthető prompt`,
      }),
    );
    await screen.findByRole("dialog");
    await expectNoA11yViolations(document);
  });

  it("Esc closes the edit modal", async () => {
    server.use(
      http.get(`${base}/prompt-templates`, () =>
        HttpResponse.json([editableTemplate]),
      ),
    );
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Szerkeszthető prompt");

    await user.click(
      screen.getByRole("button", {
        name: `${hu.promptLibrary.editLabel}: Szerkeszthető prompt`,
      }),
    );
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
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
