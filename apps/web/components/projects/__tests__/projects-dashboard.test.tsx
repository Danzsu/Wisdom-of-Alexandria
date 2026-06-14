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
});
