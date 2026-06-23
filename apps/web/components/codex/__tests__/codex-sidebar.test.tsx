import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  resetBookStore,
  resetCodexStore,
  resetSeriesStore,
} from "@/test/msw/handlers";
import { FAROSZ_BOOK } from "@/test/msw/fixtures";
import { CodexSidebar } from "@/components/shell/codex-sidebar";

const base = `${API_BASE_URL}/api/v1`;
const replaceSpy = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => `/konyv/${FAROSZ_BOOK.id}/codex`,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: replaceSpy, push: vi.fn() }),
}));

function renderSidebar() {
  return render(
    <Providers>
      <CodexSidebar />
    </Providers>,
  );
}

describe("CodexSidebar", () => {
  beforeEach(() => {
    resetCodexStore();
    resetSeriesStore();
    resetBookStore();
    replaceSpy.mockClear();
  });

  it("lists the project's codex entries grouped by type", async () => {
    renderSidebar();
    // Character group heading + the seeded entries.
    expect(await screen.findByText("Karakterek · 1")).toBeInTheDocument();
    expect(screen.getByText("Helyszínek · 1")).toBeInTheDocument();
    expect(screen.getByText("Szelene")).toBeInTheDocument();
    expect(screen.getByText("Nagykönyvtár")).toBeInTheDocument();
  });

  it("shows the empty state (EmptyState kit) when the project has no codex entries", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/codex`, () =>
        HttpResponse.json([]),
      ),
    );
    renderSidebar();
    expect(await screen.findByText("Még üres a Codex")).toBeInTheDocument();
    // EmptyState renders title as an h2
    expect(screen.getByRole("heading", { name: "Még üres a Codex" })).toBeInTheDocument();
  });

  it("surfaces a list error via ErrorState (never swallowed)", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/codex`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderSidebar();
    const alert = await screen.findByRole("alert");
    // ErrorState renders the message prominently; detail rendered as muted text
    expect(alert).toBeInTheDocument();
  });

  it("retry button on codex list ErrorState refetches and shows entries", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/codex`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderSidebar();

    // Wait for error state.
    await screen.findByRole("alert");

    // Restore success handler before retry.
    server.resetHandlers();

    // Click the retry button rendered by ErrorState.
    await user.click(screen.getByRole("button", { name: "Újrapróbálkozás" }));

    // Entries should now appear.
    expect(await screen.findByText("Szelene")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("selecting an entry writes the ?entry param", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(await screen.findByText("Szelene"));
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.stringContaining("entry=codex-szelene"),
    );
  });

  it("filters the list by the search input (name + alias)", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Szelene");
    await user.type(screen.getByLabelText("Keresés…"), "Lené");
    // "Lené" is an alias of Szelene; the location should drop out.
    await waitFor(() =>
      expect(screen.queryByText("Nagykönyvtár")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Szelene")).toBeInTheDocument();
  });

  it("opens the New-Codex modal from the + Új button", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Szelene");
    await user.click(screen.getByRole("button", { name: "Új" }));
    expect(
      await screen.findByText("Válaszd ki a bejegyzés típusát:"),
    ).toBeInTheDocument();
  });

  it("exposes an enabled Projekt/Sorozat scope toggle (Feature #3c)", async () => {
    renderSidebar();
    await screen.findByText("Szelene");
    const projectScope = screen.getByRole("button", { name: "Projekt" });
    const seriesScope = screen.getByRole("button", { name: "Sorozat" });
    expect(projectScope).toBeEnabled();
    expect(seriesScope).toBeEnabled();
    // Project scope is the default (pressed).
    expect(projectScope).toHaveAttribute("aria-pressed", "true");
    expect(seriesScope).toHaveAttribute("aria-pressed", "false");
  });
});
