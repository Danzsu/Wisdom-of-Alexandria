/**
 * Component tests for the Cselekményszálak (subplots) screen (Plotline-b).
 * Exercises the REAL MSW path against the stateful plotline store: plotlines
 * render grouped by type with status badges, the empty + error-retry states, the
 * create / attach-scene / delete round-trips (each proven against the store, not
 * the request URL/payload), the scene chip deep-link route, and the
 * cross-project attach error surfaced (not swallowed).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { resetPlotlineStore } from "@/test/msw/handlers";
import { FAROSZ_BOOK, SCENE_FIRST, SCENE_ACTIVE } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";
import { PlotlinesScreen } from "../plotlines-screen";

const base = `${API_BASE_URL}/api/v1`;

// useNavTo's router.push must not blow up in jsdom (the modal toasts use it
// indirectly via Providers); deep-links are plain <a href> so we assert href.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}));

describe("PlotlinesScreen", () => {
  beforeEach(() => {
    resetPlotlineStore();
    pushMock.mockClear();
  });

  it("renders plotlines grouped by type with status badges", async () => {
    render(
      <Providers>
        <PlotlinesScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );

    // Both seeded plotlines render under their type group headers.
    await waitFor(() =>
      expect(screen.getByText("A Fárosz fénye")).toBeInTheDocument(),
    );
    expect(screen.getByText("Szelene és a tiltott termek")).toBeInTheDocument();

    // Group headers (localized type labels).
    expect(
      screen.getByRole("heading", { name: hu.plotlines.type.main_plot }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: hu.plotlines.type.subplot }),
    ).toBeInTheDocument();

    // Status pills (localized): main plot is "active", subplot is "planning".
    expect(screen.getByText(hu.plotlines.status.active)).toBeInTheDocument();
    expect(screen.getByText(hu.plotlines.status.planning)).toBeInTheDocument();
  });

  it("shows the calm empty state when there are no plotlines", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/plotlines`, () =>
        HttpResponse.json([]),
      ),
    );
    render(
      <Providers>
        <PlotlinesScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText(hu.plotlines.emptyTitle)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: hu.plotlines.emptyCta }),
    ).toBeInTheDocument();
  });

  it("surfaces an error state with retry when the plotlines query fails", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/plotlines`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    render(
      <Providers>
        <PlotlinesScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText(hu.plotlines.error)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: hu.plotlines.retry }),
    ).toBeInTheDocument();
  });

  it("renders an attached scene chip that deep-links to the scene's Write view", async () => {
    // The main plot is seeded with SCENE_FIRST attached → its chip is an <a>
    // pointing at the scene's Write route.
    render(
      <Providers>
        <PlotlinesScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    const chip = await screen.findByRole("link", {
      name: hu.plotlines.openSceneAria(SCENE_FIRST.title),
    });
    expect(chip).toHaveAttribute(
      "href",
      `/konyv/${FAROSZ_BOOK.id}/iras/${SCENE_FIRST.id}`,
    );
  });

  it("[mutation-proof] creates a plotline and the new card appears (store round-trip)", async () => {
    // A REAL list → create → appears round-trip against the stateful store (no
    // POST override). If `useCreatePlotline`'s list invalidation breaks, the new
    // card never appears and this fails.
    const user = userEvent.setup();
    render(
      <Providers>
        <PlotlinesScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("A Fárosz fénye")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Új mellékszál")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: hu.plotlines.addNew }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(hu.plotlines.modalTitleLabel),
      "Új mellékszál",
    );
    await user.click(
      within(dialog).getByRole("button", { name: hu.plotlines.modalCreate }),
    );

    // The store persisted it and the invalidated list re-rendered with the card.
    await waitFor(() =>
      expect(screen.getByText("Új mellékszál")).toBeInTheDocument(),
    );
    // The originals remain (the store appended, not replaced).
    expect(screen.getByText("A Fárosz fénye")).toBeInTheDocument();
  });

  it("[mutation-proof] attaches a scene and the new chip appears (store round-trip)", async () => {
    // The subplot starts with NO scenes. Attach SCENE_ACTIVE → its chip appears.
    // If `useAttachPlotlineScene`'s per-plotline scene-list invalidation breaks,
    // the chip never appears and this fails.
    const user = userEvent.setup();
    render(
      <Providers>
        <PlotlinesScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(
        screen.getByText("Szelene és a tiltott termek"),
      ).toBeInTheDocument(),
    );

    // The subplot card has no scene chips yet; SCENE_ACTIVE is not linked.
    expect(
      screen.queryByRole("link", {
        name: hu.plotlines.openSceneAria(SCENE_ACTIVE.title),
      }),
    ).not.toBeInTheDocument();

    // Open the attach picker on the subplot card (the second "attach" button).
    const attachButtons = screen.getAllByRole("button", {
      name: hu.plotlines.attachScene,
    });
    await user.click(attachButtons[1]);

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText(hu.plotlines.attachModalSceneLabel),
      SCENE_ACTIVE.id,
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: hu.plotlines.attachModalSubmit,
      }),
    );

    // The chip appears from the re-fetched store list.
    await waitFor(() =>
      expect(
        screen.getByRole("link", {
          name: hu.plotlines.openSceneAria(SCENE_ACTIVE.title),
        }),
      ).toBeInTheDocument(),
    );
  });

  it("[mutation-proof] deletes a plotline and its card disappears (store round-trip)", async () => {
    // list → delete (confirm) → the plotline is gone from the store and the
    // invalidated list no longer shows its card. If `useDeletePlotline`'s
    // invalidation (or the store remove) breaks, the card persists and this fails.
    const user = userEvent.setup();
    render(
      <Providers>
        <PlotlinesScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("A Fárosz fénye")).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", {
        name: hu.plotlines.deleteAria("A Fárosz fénye"),
      }),
    );
    // Confirm in the alert dialog.
    const confirm = await screen.findByRole("alertdialog");
    await user.click(
      within(confirm).getByRole("button", {
        name: hu.plotlines.deleteConfirm,
      }),
    );

    await waitFor(() =>
      expect(screen.queryByText("A Fárosz fénye")).not.toBeInTheDocument(),
    );
    // The other plotline remains.
    expect(screen.getByText("Szelene és a tiltott termek")).toBeInTheDocument();
  });

  it("surfaces a cross-project attach error inline (400, not swallowed)", async () => {
    // Attaching a scene id that does not belong to the project → backend 400.
    // The error must surface inline in the modal, not be silently dropped.
    server.use(
      // Offer a bogus scene so we can pick it; the POST guard rejects it.
      http.post(`${base}/plotlines/:plotlineId/scenes`, () =>
        HttpResponse.json(
          { detail: "Scene belongs to a different project" },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(
      <Providers>
        <PlotlinesScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("A Fárosz fénye")).toBeInTheDocument(),
    );

    const attachButtons = screen.getAllByRole("button", {
      name: hu.plotlines.attachScene,
    });
    await user.click(attachButtons[1]);
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText(hu.plotlines.attachModalSceneLabel),
      SCENE_ACTIVE.id,
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: hu.plotlines.attachModalSubmit,
      }),
    );

    // The inline error (with the surfaced server detail) is shown.
    expect(
      await within(dialog).findByText(
        new RegExp(hu.plotlines.attachError),
      ),
    ).toBeInTheDocument();
  });
});
