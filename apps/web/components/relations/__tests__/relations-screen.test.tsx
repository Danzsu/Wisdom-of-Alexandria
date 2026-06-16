/**
 * Component tests for the relationship-graph screen (UX-3a). Exercises the real
 * MSW path: the graph renders nodes + edges from relations (static SVG, the path
 * tests assert), the empty state, the create-relation flow, the muted
 * missing-entity node, and the reduced-motion static render (no GSAP, no crash).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { FAROSZ_BOOK, FAROSZ_PROJECT } from "@/test/msw/fixtures";
import { RelationsScreen } from "../relations-screen";

const base = `${API_BASE_URL}/api/v1`;

// The screen resolves project via books; the resolver reads the route's bookId.
// We pass bookId directly as a prop, so no router mock is needed for the screen.

describe("RelationsScreen", () => {
  beforeEach(() => {
    // Default: motion enabled is fine — canAnimate() is gated on NODE_ENV=test
    // so GSAP never runs under vitest regardless.
  });

  it("renders nodes and edges from the project's relations (static path)", async () => {
    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );

    // Two relations in the fixture → two edges, three distinct nodes
    // (Szelene, Nagykönyvtár, and the missing mentor placeholder).
    await waitFor(() =>
      expect(screen.getByText("Szelene")).toBeInTheDocument(),
    );
    expect(screen.getByText("Nagykönyvtár")).toBeInTheDocument();
    // Edge labels render.
    expect(screen.getByText("őrzője")).toBeInTheDocument();
    expect(screen.getByText("mentora")).toBeInTheDocument();
    // Toolbar count reflects 3 nodes + 2 edges.
    expect(screen.getByText(/3 bejegyzés/)).toBeInTheDocument();
    expect(screen.getByText(/2 kapcsolat/)).toBeInTheDocument();
  });

  it("degrades a missing referenced entity to a muted 'Ismeretlen' node", async () => {
    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("Ismeretlen bejegyzés")).toBeInTheDocument(),
    );
    // It is exposed as an accessible node with the missing hint in its label.
    const ghost = screen.getByRole("button", { name: /Ismeretlen bejegyzés/ });
    expect(ghost).toBeInTheDocument();
  });

  it("shows the calm empty state when there are no relations", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/codex-relations`, () =>
        HttpResponse.json([]),
      ),
    );
    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("Még nincs kapcsolat")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Első kapcsolat" }),
    ).toBeInTheDocument();
  });

  it("opens a node's detail panel on click and lists its relations", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("Szelene")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Szelene" }));

    // The detail panel (aside) shows Szelene's two relations.
    const panel = await screen.findByRole("complementary");
    expect(within(panel).getByText("őrzője")).toBeInTheDocument();
    expect(within(panel).getByText("mentora")).toBeInTheDocument();
    // And a link to open the entry in the Codex.
    expect(
      within(panel).getByRole("link", { name: /Megnyitás a Codexben/ }),
    ).toHaveAttribute(
      "href",
      `/konyv/${FAROSZ_BOOK.id}/codex?entry=codex-szelene`,
    );
  });

  it("creates a relation via the modal (POSTs the payload)", async () => {
    const user = userEvent.setup();
    let captured: unknown = null;
    server.use(
      http.post(
        `${base}/projects/:projectId/codex-relations`,
        async ({ request }) => {
          captured = await request.json();
          return HttpResponse.json(
            {
              id: "rel-new-test",
              project_id: FAROSZ_PROJECT.id,
              from_entity_type: "character",
              from_entity_id: "codex-szelene",
              to_entity_type: "location",
              to_entity_id: "codex-nagykonyvtar",
              relation_type: "látogatja",
              description: null,
              created_at: "2026-06-14T16:00:00Z",
              updated_at: "2026-06-14T16:00:00Z",
            },
            { status: 201 },
          );
        },
      ),
    );

    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("Szelene")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Új kapcsolat" }));

    // Pick endpoints + type in the modal.
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText("Honnan"),
      "codex-szelene",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Hová"),
      "codex-nagykonyvtar",
    );
    await user.type(
      within(dialog).getByLabelText("Kapcsolat típusa"),
      "látogatja",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Kapcsolat létrehozása" }),
    );

    await waitFor(() =>
      expect(captured).toMatchObject({
        from_entity_id: "codex-szelene",
        to_entity_id: "codex-nagykonyvtar",
        relation_type: "látogatja",
      }),
    );
  });

  it("blocks a self-loop with an inline error", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("Szelene")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Új kapcsolat" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText("Honnan"),
      "codex-szelene",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Hová"),
      "codex-szelene",
    );
    await user.type(
      within(dialog).getByLabelText("Kapcsolat típusa"),
      "barátja",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Kapcsolat létrehozása" }),
    );
    expect(
      await within(dialog).findByText(
        "Egy bejegyzés nem kapcsolódhat önmagához.",
      ),
    ).toBeInTheDocument();
  });

  it("renders statically under prefers-reduced-motion (no GSAP, no crash)", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      render(
        <Providers>
          <RelationsScreen bookId={FAROSZ_BOOK.id} />
        </Providers>,
      );
      // The graph still renders its nodes — the static SVG is the baseline.
      await waitFor(() =>
        expect(screen.getByText("Szelene")).toBeInTheDocument(),
      );
      expect(screen.getByText("őrzője")).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});
