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
import { resetRelationStore } from "@/test/msw/handlers";
import { FAROSZ_BOOK } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";
import { RelationsScreen } from "../relations-screen";

const base = `${API_BASE_URL}/api/v1`;

// The screen resolves project via books; the resolver reads the route's bookId.
// We pass bookId directly as a prop, so no router mock is needed for the screen.

// Mock GSAP so we can ASSERT it is never entered when animation is gated off.
// The graph's `canAnimateGsapNow()` short-circuits under the test env, so
// `import("gsap")` must never run and `gsap.context` must never be called. A
// mutation that inverts the gate (GSAP running under the static baseline) makes
// the "does not invoke GSAP" test fail.
const gsapContextMock = vi.fn(() => ({ revert: vi.fn() }));
vi.mock("gsap", () => ({
  gsap: { context: gsapContextMock },
  default: { context: gsapContextMock },
}));

describe("RelationsScreen", () => {
  beforeEach(() => {
    // Reset the stateful MSW relation store so list/create/delete tests don't
    // pollute each other.
    resetRelationStore();
    gsapContextMock.mockClear();
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
    // EmptyState renders title as an h2.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: hu.relations.emptyTitle }),
      ).toBeInTheDocument(),
    );
    // CTA wired via EmptyState action.
    expect(
      screen.getByRole("button", { name: hu.relations.emptyCta }),
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

  it("creates a relation and the new edge appears in the graph (round-trip)", async () => {
    // A REAL list → create → appears round-trip against the stateful MSW store
    // (no POST override, so the store actually persists the new relation and the
    // invalidated list query re-renders the graph with it). A mutation that
    // breaks the create's query invalidation makes the new edge never appear.
    const user = userEvent.setup();

    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText("Szelene")).toBeInTheDocument());

    // The new label is not present before creating it.
    expect(screen.queryByText("látogatja")).not.toBeInTheDocument();

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

    // The graph re-renders with the new edge's label (it came from the store).
    await waitFor(() =>
      expect(screen.getByText("látogatja")).toBeInTheDocument(),
    );
    // The original edges are still present (the store appended, didn't replace).
    expect(screen.getByText("őrzője")).toBeInTheDocument();
  });

  it("deletes a relation from the detail panel and removes its edge", async () => {
    // list → select node → delete → the relation is gone from the stateful store
    // and the graph/list no longer show its label. A mutation that breaks the
    // delete (store remove / query invalidation) makes the edge persist.
    const user = userEvent.setup();

    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText("Szelene")).toBeInTheDocument());

    // Open Szelene's detail panel — it lists her two relations.
    await user.click(screen.getByRole("button", { name: "Szelene" }));
    const panel = await screen.findByRole("complementary");
    expect(within(panel).getByText("őrzője")).toBeInTheDocument();

    // Delete the "őrzője" relation via its row delete button.
    const deleteButtons = within(panel).getAllByRole("button", {
      name: hu.relations.deleteRelationAria,
    });
    await user.click(deleteButtons[0]);

    // After the delete + invalidation, "őrzője" is gone from the whole screen.
    await waitFor(() =>
      expect(screen.queryByText("őrzője")).not.toBeInTheDocument(),
    );
    // The other relation remains (it renders both as a graph edge label and in
    // the still-open detail panel, so assert it is still present at all).
    expect(screen.getAllByText("mentora").length).toBeGreaterThan(0);
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

  it("does NOT enter GSAP when animation is gated off (static SVG baseline)", async () => {
    // The graph's gate short-circuits under the test env, so the GSAP edge/node
    // draw-in must never run: `gsap.context` is the entry point and must NOT be
    // called. (A mutation that inverts the gate makes this fail.) The static SVG
    // still renders fully.
    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText("Szelene")).toBeInTheDocument());
    expect(screen.getByText("őrzője")).toBeInTheDocument();

    // GSAP was never entered — give any stray async import() a tick to land.
    await new Promise((r) => setTimeout(r, 0));
    expect(gsapContextMock).not.toHaveBeenCalled();
  });

  it("surfaces an error state when the relations query fails and clicking retry refetches and recovers", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${base}/projects/:projectId/codex-relations`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    // ErrorState uses role="alert" and includes a retry button.
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(screen.getByText(hu.relations.error)).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: hu.common.retry });
    expect(retryButton).toBeInTheDocument();

    // Mutation-proof: restore the default handler so the refetch succeeds.
    // If onRetry is a no-op the refetch never fires, the alert persists and
    // the graph nodes never appear — failing the assertions below.
    server.resetHandlers();
    await user.click(retryButton);

    // After retry the screen recovers: alert disappears and graph data loads.
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Szelene")).toBeInTheDocument();
  });
});
