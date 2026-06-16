import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { hu } from "@/lib/i18n/hu";
import { ProjectsDashboard } from "@/components/projects/projects-dashboard";

const base = `${API_BASE_URL}/api/v1`;

// Mock next/navigation so useNavTo's router.push doesn't blow up in jsdom.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}));

describe("ProjectsDashboard", () => {
  it("renders projects from the mocked API", async () => {
    renderWithProviders(<ProjectsDashboard />);
    await waitFor(() =>
      expect(screen.getAllByText("A Fárosz őrzője").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("Homoktenger levelei").length).toBeGreaterThan(0);
  });

  it("shows loading skeletons before data arrives", async () => {
    // Delay the response so the loading state is observable.
    server.use(
      http.get(`${base}/projects`, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json([]);
      }),
    );
    const { container } = renderWithProviders(<ProjectsDashboard />);
    expect(container.querySelectorAll(".woa-skel").length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no projects", async () => {
    server.use(http.get(`${base}/projects`, () => HttpResponse.json([])));
    renderWithProviders(<ProjectsDashboard />);
    expect(await screen.findByText(hu.projects.emptyTitle)).toBeInTheDocument();
  });

  it("shows an error state with retry when the API fails", async () => {
    server.use(
      http.get(`${base}/projects`, () =>
        HttpResponse.json({ detail: "szerverhiba" }, { status: 500 }),
      ),
    );
    renderWithProviders(<ProjectsDashboard />);
    expect(await screen.findByText(hu.projects.errorTitle)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: hu.projects.errorRetry }),
    ).toBeInTheDocument();
  });

  it("renders per-project book + word counts on the cards (Feature #1)", async () => {
    renderWithProviders(<ProjectsDashboard />);
    await screen.findAllByText("A Fárosz őrzője");

    // The formatter pins the contract; the card renders its output. Match on the
    // load-bearing pieces (book count + grouped word count) with a flexible
    // matcher so locale whitespace (regular vs narrow no-break space) can't make
    // the assertion brittle.
    const farosz = hu.projects.metaCounts(1, 12450);
    expect(farosz).toContain("1 könyv");
    const wordPart = (12450).toLocaleString("hu-HU");
    expect(
      screen.getAllByText((_t, el) => {
        const text = el?.textContent ?? "";
        return text.includes("1 könyv") && text.includes(`${wordPart} szó`);
      }).length,
    ).toBeGreaterThan(0);

    // Homok: 0 books → the graceful empty path ("Nincs könyv").
    const homok = hu.projects.metaCounts(0, 0);
    expect(homok).toContain("Nincs könyv");
    expect(
      screen.getAllByText((_t, el) =>
        (el?.textContent ?? "").includes("Nincs könyv"),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("opens the New-book wizard from the primary quick action", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsDashboard />);
    await screen.findAllByText("A Fárosz őrzője");

    // The quick-action grid's primary tile ("Új könyv").
    const newBookButtons = screen.getAllByRole("button", {
      name: hu.projects.quickNewBook,
    });
    await user.click(newBookButtons[0]);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(hu.wizard.dialogTitle),
    ).toBeInTheDocument();
  });

  it("opens the restore dialog from the restore quick action (Feature #5)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectsDashboard />);
    await screen.findAllByText("A Fárosz őrzője");

    await user.click(
      screen.getByRole("button", { name: hu.backup.restoreAction }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(hu.backup.restoreTitle),
    ).toBeInTheDocument();
  });

  it("exports a project backup from the card actions menu (Feature #5)", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:woa");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    let backupHit = false;
    server.use(
      http.get(`${base}/projects/:projectId/backup`, () => {
        backupHit = true;
        return HttpResponse.json(
          { version: 1, project: { title: "x" } },
          {
            headers: {
              "Content-Disposition": 'attachment; filename="x-backup.json"',
            },
          },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ProjectsDashboard />);
    await screen.findAllByText("A Fárosz őrzője");

    // Open the first per-card actions menu, then click "Exportálás (JSON)".
    const menuButtons = screen.getAllByRole("button", {
      name: hu.backup.menuAria,
    });
    await user.click(menuButtons[0]);
    await user.click(await screen.findByText(hu.backup.exportAction));

    await waitFor(() => expect(backupHit).toBe(true));
    vi.restoreAllMocks();
  });
});
