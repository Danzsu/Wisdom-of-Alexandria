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

// Mock GSAP so we can ASSERT it is never entered when animation is gated off.
// `canAnimateGsapNow()` short-circuits under the test env (and under reduced
// motion in prod), so `import("gsap")` must never run and `gsap.context` must
// never be called. If the gate inverts, this mock records the call and the
// "does not invoke GSAP" test fails.
const gsapContextMock = vi.fn(() => ({ revert: vi.fn() }));
vi.mock("gsap", () => ({
  gsap: { context: gsapContextMock },
  default: { context: gsapContextMock },
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
    gsapContextMock.mockClear();
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

  it("renders each scene's word count from the fixture", async () => {
    render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    // SCENE_FIRST.word_count === 4, SCENE_ACTIVE.word_count === 13.
    // (A mutation rendering a constant instead of word_count fails this.)
    await waitFor(() =>
      expect(screen.getByText(hu.timeline.sceneWords(4))).toBeInTheDocument(),
    );
    expect(screen.getByText(hu.timeline.sceneWords(13))).toBeInTheDocument();
  });

  it("orders scenes within a chapter by order_index, not array order", async () => {
    // Two scenes in CHAPTER_ONE supplied OUT of order_index order in the array:
    // the array lists order_index 2 first, then 0 — the screen must sort them so
    // "Első jelenet" (0) precedes "Második jelenet" (2). (Reversing the intra-
    // chapter sort fails this.)
    server.use(
      http.get(`${base}/chapters/:chapterId/scenes`, ({ params }) => {
        if (String(params.chapterId) === CHAPTER_ONE.id) {
          return HttpResponse.json([
            {
              id: "5cea2222-2222-2222-2222-222222222222",
              chapter_id: CHAPTER_ONE.id,
              title: "Második jelenet",
              content: "x",
              summary: null,
              order_index: 2,
              status: "draft",
              word_count: 2,
              pov_character_id: null,
              created_at: "2026-06-14T14:32:00Z",
              updated_at: "2026-06-14T14:32:00Z",
            },
            {
              id: "5cea1111-1111-1111-1111-111111111111",
              chapter_id: CHAPTER_ONE.id,
              title: "Első jelenet",
              content: "x",
              summary: null,
              order_index: 0,
              status: "complete",
              word_count: 1,
              pov_character_id: null,
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
    await waitFor(() =>
      expect(screen.getByText("Első jelenet")).toBeInTheDocument(),
    );
    const first = screen.getByText("Első jelenet");
    const second = screen.getByText("Második jelenet");
    expect(first.compareDocumentPosition(second)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("reflects the status → marker-state mapping on the scene node in the DOM", async () => {
    const { container } = render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(
        screen.getByText("1. jelenet — Az éjszakai műszak"),
      ).toBeInTheDocument(),
    );
    // SCENE_FIRST is "complete" → "completed"; SCENE_ACTIVE is "draft" → "planned".
    // Asserted via the marker's data attribute (the rendered DOM, not the unit fn).
    const states = Array.from(
      container.querySelectorAll<HTMLElement>("[data-marker-state]"),
    ).map((el) => el.dataset.markerState);
    expect(states).toContain("completed");
    expect(states).toContain("planned");
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
    // EmptyState renders title as an h2.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: hu.timeline.emptyTitle }),
      ).toBeInTheDocument(),
    );
    // The CTA is wired to the Plan Board via EmptyState action.
    expect(
      screen.getByRole("button", { name: hu.timeline.emptyCta }),
    ).toBeInTheDocument();
  });

  it("surfaces an error with a retry button and clicking retry refetches and recovers", async () => {
    const user = userEvent.setup();
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
    // ErrorState uses role="alert".
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(hu.timeline.error),
    ).toBeInTheDocument();
    // Retry button comes from ErrorState (uses hu.common.retry).
    const retryButton = screen.getByRole("button", { name: hu.common.retry });
    expect(retryButton).toBeInTheDocument();

    // Mutation-proof: restore the default successful handler so the refetch succeeds.
    // If onRetry is a no-op, the refetch never fires, the alert persists and
    // the chapter heading never appears — failing the assertions below.
    server.resetHandlers();
    await user.click(retryButton);

    // After retry the screen recovers: the alert disappears and chapter data loads.
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(CHAPTER_ONE.title)).toBeInTheDocument();
  });

  it("does NOT enter GSAP when animation is gated off (static baseline)", async () => {
    // The gate short-circuits under the test env, so the GSAP draw-in must never
    // run: `gsap.context` is the entry point and must NOT be called. (A mutation
    // that inverts the gate — GSAP running under the static baseline — makes this
    // fail.) The static render still renders fully.
    render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
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

    // GSAP was never entered — give any stray async import() a tick to land.
    await new Promise((r) => setTimeout(r, 0));
    expect(gsapContextMock).not.toHaveBeenCalled();
  });
});
