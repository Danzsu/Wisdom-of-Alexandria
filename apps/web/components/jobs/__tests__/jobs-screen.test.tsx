import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Providers } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { FAROSZ_BOOK, JOB_FAILED } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";
import { JobsScreen } from "../jobs-screen";

const aiBase = `${AI_BASE_URL}/api/v1`;

function renderScreen(bookId: string | undefined = FAROSZ_BOOK.id) {
  return render(
    <Providers>
      <JobsScreen bookId={bookId} />
    </Providers>,
  );
}

/**
 * Resolve the job-row card that owns a given (unique) type label. The type label
 * is a `<span>` and the status badge is its sibling inside the same Card, so we
 * walk up to the nearest element that contains both — letting us scope each
 * status assertion to ONE row instead of asserting it exists somewhere on screen.
 */
function rowByTypeLabel(typeLabel: string): HTMLElement {
  const label = screen.getByText(typeLabel);
  // Card → body wrapper → flex header where the type span + status badge live.
  // `closest("div")` chain: the type span's parent (the flex header) holds both.
  const row = label.closest("div");
  if (!row) throw new Error(`No row container for "${typeLabel}"`);
  return row as HTMLElement;
}

describe("JobsScreen (AI feladatok)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders each seeded job with its OWN type→status pairing", async () => {
    renderScreen();
    await screen.findByText("Átírás");

    // Each status is scoped to ITS OWN row keyed off the job's type label. This
    // is the mutation-proof part: swapping the running↔done label mapping in
    // jobs-screen.tsx moves "Kész"/"Folyamatban" onto the WRONG row → fails here.
    // The done job is "Átírás" (rewrite).
    expect(within(rowByTypeLabel("Átírás")).getByText("Kész")).toBeInTheDocument();
    // The running job is "Jelenet generálása" (generate_scene).
    expect(
      within(rowByTypeLabel("Jelenet generálása")).getByText("Folyamatban"),
    ).toBeInTheDocument();
    // The failed job is "Érzéki leírás" (describe).
    expect(
      within(rowByTypeLabel("Érzéki leírás")).getByText("Sikertelen"),
    ).toBeInTheDocument();
  });

  it("renders exactly the seeded number of job rows (no drop / duplicate)", async () => {
    renderScreen();
    await screen.findByText("Átírás");
    // Every job row shows a status badge; the badge text set is the 3 statuses.
    // Counting the three distinct type labels pins the rendered row count to the
    // 3 seeded jobs.
    expect(screen.getByText("Átírás")).toBeInTheDocument();
    expect(screen.getByText("Jelenet generálása")).toBeInTheDocument();
    expect(screen.getByText("Érzéki leírás")).toBeInTheDocument();
    // No EXTRA job rows: there must be exactly 3 status badges on screen.
    const statusBadges = [
      ...screen.getAllByText(/^(Kész|Folyamatban|Sikertelen)$/),
    ];
    expect(statusBadges).toHaveLength(3);
  });

  it("reveals the backend error message for a failed job on expand", async () => {
    renderScreen();
    const toggle = await screen.findByRole("button", {
      name: "Hibaüzenet megjelenítése",
    });
    // Collapsed by default — the message is not shown yet.
    expect(
      screen.queryByText(JOB_FAILED.error_message as string),
    ).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(
      await screen.findByText(JOB_FAILED.error_message as string),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the book has no jobs", async () => {
    // A book id with no seeded jobs returns an empty list.
    renderScreen("00000000-0000-0000-0000-000000000000");
    // EmptyState renders title as an h2.
    expect(
      await screen.findByRole("heading", { name: hu.jobs.emptyTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(hu.jobs.emptyHint)).toBeInTheDocument();
  });

  it("shows an error state when the jobs fetch fails and clicking retry refetches and recovers", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${aiBase}/jobs`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderScreen();
    // ErrorState uses role="alert".
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(hu.jobs.errorTitle)).toBeInTheDocument();
    // Retry button comes from ErrorState (uses hu.common.retry).
    const retryButton = screen.getByRole("button", { name: hu.common.retry });
    expect(retryButton).toBeInTheDocument();

    // Mutation-proof: restore the default handler so the refetch succeeds.
    // If onRetry is a no-op the refetch never fires, the alert persists and
    // the job rows never appear — failing the assertions below.
    server.resetHandlers();
    await user.click(retryButton);

    // After retry the screen recovers: alert disappears and job rows load.
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Átírás")).toBeInTheDocument();
  });

  it("renders an unknown status/type gracefully (raw fallback, no crash)", async () => {
    server.use(
      http.get(`${aiBase}/jobs`, () =>
        HttpResponse.json([
          {
            id: "job-weird-1",
            project_id: null,
            scene_id: null,
            chapter_id: null,
            job_type: "teleport_scene",
            status: "frozen",
            model_name: null,
            prompt_version: null,
            input_data: null,
            output_data: null,
            error_message: null,
            created_at: "2026-06-15T11:00:00Z",
            updated_at: "2026-06-15T11:00:00Z",
          },
        ]),
      ),
    );
    renderScreen();
    // The unknown job_type + status fall back to their raw strings.
    expect(await screen.findByText("teleport_scene")).toBeInTheDocument();
    expect(screen.getByText("frozen")).toBeInTheDocument();
    // "Not bound to a scene" context for the null scene/chapter.
    expect(screen.getByText("Nincs jelenethez kötve")).toBeInTheDocument();
  });
});
