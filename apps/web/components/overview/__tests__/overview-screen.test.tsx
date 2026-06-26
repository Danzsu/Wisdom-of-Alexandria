import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import {
  resetPlanStore,
  resetPlotlineStore,
  resetBookStore,
} from "@/test/msw/handlers";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { hu } from "@/lib/i18n/hu";
import {
  FAROSZ_BOOK,
  FAROSZ_PROJECT,
  PLOTLINE_MAIN,
  PLOTLINE_SUBPLOT,
} from "@/test/msw/fixtures";
import type {
  BookRead,
  ChapterRead,
  PlotlineRead,
  SceneRead,
} from "@/lib/api/types";

const base = `${API_BASE_URL}/api/v1`;

// next/navigation is module-mocked: the Overview screen reads `bookId` from the
// route and its quick actions navigate via the router. We assert both.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id }),
  useRouter: () => ({ push }),
}));

import { OverviewScreen } from "../overview-screen";

/** A book WITH a synopsis so the synopsis card has real copy to assert. */
const BOOK_WITH_SYNOPSIS: BookRead = {
  ...FAROSZ_BOOK,
  title: "A Hamuból Írott Város",
  synopsis: "Hamuváros romjai közt egy fiatal levéltáros a tiltott tekercseket kutatja.",
  author: "Kovács Eszter",
  genre: "Fantasy",
  word_count_target: 50000,
};

/**
 * One chapter with EXACTLY 4 scenes, 2 of them `complete` → the progress bar
 * must read 50% (2/4). The other two are `draft`. A second, untouched chapter
 * (0 scenes done) anchors a different bar. These exact ratios drive the
 * mutation-proof progress assertions.
 */
const CH_GATE: ChapterRead = {
  id: "ch-gate",
  book_id: BOOK_WITH_SYNOPSIS.id,
  title: "I. A kapu",
  summary: null,
  order_index: 0,
  status: "in_progress",
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

const CH_ASHES: ChapterRead = {
  id: "ch-ashes",
  book_id: BOOK_WITH_SYNOPSIS.id,
  title: "II. A hamu városa",
  summary: null,
  order_index: 1,
  status: "draft",
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

function scene(
  id: string,
  chapterId: string,
  status: string,
  wordCount: number,
  order: number,
): SceneRead {
  return {
    id,
    chapter_id: chapterId,
    title: `Jelenet ${id}`,
    content: null,
    summary: null,
    order_index: order,
    status,
    word_count: wordCount,
    pov_character_id: null,
    created_at: "2026-06-14T14:32:00Z",
    updated_at: "2026-06-14T14:32:00Z",
  };
}

const GATE_SCENES: SceneRead[] = [
  scene("g1", CH_GATE.id, "complete", 600, 0),
  scene("g2", CH_GATE.id, "complete", 700, 1),
  scene("g3", CH_GATE.id, "draft", 0, 2),
  scene("g4", CH_GATE.id, "draft", 0, 3),
];

const ASHES_SCENES: SceneRead[] = [
  scene("a1", CH_ASHES.id, "draft", 100, 0),
  scene("a2", CH_ASHES.id, "draft", 0, 1),
];

const PLOTLINES: PlotlineRead[] = [PLOTLINE_MAIN, PLOTLINE_SUBPLOT];

/**
 * Wire the full read path the screen depends on: resolve the book (projects →
 * books), its chapter+scene tree, and the project's plotlines.
 */
function useFullData() {
  server.use(
    http.get(`${base}/projects`, () => HttpResponse.json([FAROSZ_PROJECT])),
    http.get(`${base}/projects/:projectId/books`, () =>
      HttpResponse.json([BOOK_WITH_SYNOPSIS]),
    ),
    http.get(`${base}/books/:bookId/chapters`, () =>
      HttpResponse.json([CH_GATE, CH_ASHES]),
    ),
    http.get(`${base}/chapters/:chapterId/scenes`, ({ params }) => {
      const cid = String(params.chapterId);
      if (cid === CH_GATE.id) return HttpResponse.json(GATE_SCENES);
      if (cid === CH_ASHES.id) return HttpResponse.json(ASHES_SCENES);
      return HttpResponse.json([]);
    }),
    http.get(`${base}/projects/:projectId/plotlines`, () =>
      HttpResponse.json(PLOTLINES),
    ),
  );
}

function renderScreen() {
  return render(
    <Providers>
      <OverviewScreen />
    </Providers>,
  );
}

describe("OverviewScreen", () => {
  beforeEach(() => {
    push.mockClear();
    resetPlanStore();
    resetPlotlineStore();
    resetBookStore();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the real book title + synopsis from the resolved book", async () => {
    useFullData();
    renderScreen();
    expect(
      await screen.findByRole("heading", { name: BOOK_WITH_SYNOPSIS.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(BOOK_WITH_SYNOPSIS.synopsis as string),
    ).toBeInTheDocument();
  });

  it("derives a chapter's progress from its scenes (2 of 4 complete → 50%)", async () => {
    useFullData();
    renderScreen();
    // The progress bar is labelled by the chapter title. 2 of 4 scenes complete.
    const bar = await screen.findByRole("progressbar", {
      name: CH_GATE.title,
    });
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    // A mutation that counted ALL scenes as done, or used a wrong ratio, would
    // not produce exactly 50.
  });

  it("shows 0% progress for a chapter with no completed scenes", async () => {
    useFullData();
    renderScreen();
    const bar = await screen.findByRole("progressbar", {
      name: CH_ASHES.title,
    });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders a plotlines preview from the project's plotlines", async () => {
    useFullData();
    renderScreen();
    expect(await screen.findByText(PLOTLINE_MAIN.title)).toBeInTheDocument();
    expect(screen.getByText(PLOTLINE_SUBPLOT.title)).toBeInTheDocument();
  });

  it("navigates to the Codex route when the add-character action is clicked", async () => {
    useFullData();
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole("heading", { name: BOOK_WITH_SYNOPSIS.title });
    await user.click(
      screen.getByRole("button", { name: hu.overview.actionAddCharacter }),
    );
    expect(push).toHaveBeenCalledWith(`/konyv/${FAROSZ_BOOK.id}/codex`);
  });

  it("navigates to the Stíluskalauz route from the style-guide callout", async () => {
    useFullData();
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole("heading", { name: BOOK_WITH_SYNOPSIS.title });
    await user.click(
      screen.getByRole("button", { name: hu.overview.styleGuideCalloutAria }),
    );
    expect(push).toHaveBeenCalledWith(
      `/konyv/${FAROSZ_BOOK.id}/stiluskalauz`,
    );
  });

  it("shows a skeleton while the book is loading", () => {
    server.use(
      http.get(`${base}/projects`, () => new Promise(() => {})),
    );
    const { container } = renderScreen();
    expect(
      container.querySelector('[data-testid="overview-skeleton"]'),
    ).toBeInTheDocument();
  });

  it("renders an error state when the book fails to resolve", async () => {
    server.use(
      http.get(`${base}/projects`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderScreen();
    expect(await screen.findByText(hu.overview.errorTitle)).toBeInTheDocument();
  });

  it("renders an empty state when the book has no chapters", async () => {
    server.use(
      http.get(`${base}/projects`, () => HttpResponse.json([FAROSZ_PROJECT])),
      http.get(`${base}/projects/:projectId/books`, () =>
        HttpResponse.json([BOOK_WITH_SYNOPSIS]),
      ),
      http.get(`${base}/books/:bookId/chapters`, () => HttpResponse.json([])),
      http.get(`${base}/projects/:projectId/plotlines`, () =>
        HttpResponse.json([]),
      ),
    );
    renderScreen();
    expect(await screen.findByText(hu.overview.emptyTitle)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    useFullData();
    const { container } = renderScreen();
    await screen.findByRole("heading", { name: BOOK_WITH_SYNOPSIS.title });
    await waitFor(() =>
      expect(
        screen.getByRole("progressbar", { name: CH_GATE.title }),
      ).toBeInTheDocument(),
    );
    await expectNoA11yViolations(container);
  });
});
