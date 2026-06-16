/**
 * Component + unit tests for the Idősor (timeline) screen (UX-3b). Exercises the
 * real MSW path: chapters + scenes render in reading order with POV/status, a
 * scene click navigates to its Write route, the empty state, the reduced-motion
 * static render (no GSAP, no crash), and the status → marker-state mapping.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { resetPlanStore, resetCodexStore } from "@/test/msw/handlers";
import {
  FAROSZ_BOOK,
  CHAPTER_ONE,
  CHAPTER_TWO,
} from "@/test/msw/fixtures";
import { TimelineScreen } from "../timeline-screen";
import {
  statusToMarkerState,
  sceneStatusLabel,
} from "../status-mapping";
import { hu } from "@/lib/i18n/hu";

const base = `${API_BASE_URL}/api/v1`;

// useNavTo's router.push must not blow up in jsdom; capture the pushed href.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}));

describe("status → marker-state mapping (UX-3b)", () => {
  it("maps the four scene statuses to the three marker states", () => {
    expect(statusToMarkerState("complete")).toBe("completed");
    expect(statusToMarkerState("in_progress")).toBe("current");
    expect(statusToMarkerState("draft")).toBe("planned");
    expect(statusToMarkerState("archived")).toBe("planned");
    // Unknown / empty falls back to "planned" (never throws).
    expect(statusToMarkerState("something-else")).toBe("planned");
    expect(statusToMarkerState("")).toBe("planned");
  });

  it("labels statuses in Hungarian and falls back to the raw value", () => {
    expect(sceneStatusLabel("complete")).toBe(hu.timeline.statusComplete);
    expect(sceneStatusLabel("in_progress")).toBe(hu.timeline.statusInProgress);
    expect(sceneStatusLabel("draft")).toBe(hu.timeline.statusDraft);
    expect(sceneStatusLabel("archived")).toBe(hu.timeline.statusArchived);
    expect(sceneStatusLabel("weird")).toBe("weird");
  });
});

describe("TimelineScreen", () => {
  beforeEach(() => {
    resetPlanStore();
    resetCodexStore();
    pushMock.mockClear();
  });

  it("renders chapters and their scenes in reading order with status", async () => {
    render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );

    // Both chapter headers render…
    await waitFor(() =>
      expect(screen.getByText(CHAPTER_ONE.title)).toBeInTheDocument(),
    );
    expect(screen.getByText(CHAPTER_TWO.title)).toBeInTheDocument();

    // …and the scenes within them.
    expect(
      screen.getByText("1. jelenet — Az éjszakai műszak"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("3. jelenet — Rejtett jelek"),
    ).toBeInTheDocument();

    // Status pills reflect each scene's status (complete vs draft).
    expect(screen.getByText(hu.timeline.statusComplete)).toBeInTheDocument();
    expect(screen.getByText(hu.timeline.statusDraft)).toBeInTheDocument();

    // Toolbar counts: 2 chapters, 2 scenes total.
    expect(
      screen.getByText(hu.timeline.chapterCount(2), { exact: false }),
    ).toBeInTheDocument();

    // Reading order: chapter one (and its scene) precede chapter two's scene.
    const c1 = screen.getByText(CHAPTER_ONE.title);
    const c2 = screen.getByText(CHAPTER_TWO.title);
    expect(c1.compareDocumentPosition(c2)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("resolves the POV character name when a scene has one", async () => {
    // Override chapter-one scenes with a scene that points at codex-szelene.
    server.use(
      http.get(`${base}/chapters/:chapterId/scenes`, ({ params }) => {
        if (String(params.chapterId) === CHAPTER_ONE.id) {
          return HttpResponse.json([
            {
              id: "5ce11111-1111-1111-1111-111111111111",
              chapter_id: CHAPTER_ONE.id,
              title: "POV jelenet",
              content: "x",
              summary: "Szelene nézőpontja.",
              order_index: 0,
              status: "complete",
              word_count: 1,
              pov_character_id: "codex-szelene",
              created_at: "2026-06-14T14:32:00Z",
              updated_at: "2026-06-14T14:32:00Z",
            },
          ]);
        }
        return HttpResponse.json([]);
      }),
    );

    render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );

    // The resolved POV character name (Szelene from the codex) renders on the node.
    await waitFor(() =>
      expect(screen.getByText("Szelene")).toBeInTheDocument(),
    );
  });

  it("navigates to a scene's Write route on click", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    const sceneTitle = "1. jelenet — Az éjszakai műszak";
    await waitFor(() => expect(screen.getByText(sceneTitle)).toBeInTheDocument());

    // The scene row is an accessible link; clicking it pushes the Write route.
    const row = screen.getByRole("link", {
      name: hu.timeline.openSceneAria(sceneTitle),
    });
    await user.click(row);

    expect(pushMock).toHaveBeenCalledWith(
      `/konyv/${FAROSZ_BOOK.id}/iras/5ce11111-1111-1111-1111-111111111111`,
    );
  });

  it("opens a scene with the keyboard (Enter)", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    const sceneTitle = "1. jelenet — Az éjszakai műszak";
    await waitFor(() => expect(screen.getByText(sceneTitle)).toBeInTheDocument());

    const row = screen.getByRole("link", {
      name: hu.timeline.openSceneAria(sceneTitle),
    });
    row.focus();
    await user.keyboard("{Enter}");

    expect(pushMock).toHaveBeenCalledWith(
      `/konyv/${FAROSZ_BOOK.id}/iras/5ce11111-1111-1111-1111-111111111111`,
    );
  });

  it("shows the calm empty state when the book has no scenes", async () => {
    // No chapters at all → no scenes.
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () => HttpResponse.json([])),
    );
    render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText(hu.timeline.emptyTitle)).toBeInTheDocument(),
    );
    // The CTA routes to the Plan Board.
    const cta = screen.getByRole("button", { name: hu.timeline.emptyCta });
    expect(cta).toBeInTheDocument();
  });

  it("surfaces an error with a retry button", async () => {
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText(hu.timeline.error)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: hu.timeline.retry }),
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
          <TimelineScreen bookId={FAROSZ_BOOK.id} />
        </Providers>,
      );
      // The timeline still renders its scenes — the static render is the baseline.
      await waitFor(() =>
        expect(
          screen.getByText("1. jelenet — Az éjszakai műszak"),
        ).toBeInTheDocument(),
      );
      const region = screen.getByRole("region", {
        name: hu.timeline.listAriaLabel,
      });
      expect(
        within(region).getByText("3. jelenet — Rejtett jelek"),
      ).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});
