import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Providers } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, API_BASE_URL } from "@/lib/api/client";
import {
  FAROSZ_BOOK,
  JOB_CHAPTER_GENERATE_DONE,
  SCENE_ACTIVE,
} from "@/test/msw/fixtures";
import { expectNoA11yViolations } from "@/test/a11y";
import { hu } from "@/lib/i18n/hu";
import { routes } from "@/lib/routes";
import { JobsScreen } from "../jobs-screen";

const aiBase = `${AI_BASE_URL}/api/v1`;
const base = `${API_BASE_URL}/api/v1`;

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/konyv/x/feladatok",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: pushSpy, replace: vi.fn() }),
}));

function renderScreen(bookId: string | undefined = FAROSZ_BOOK.id) {
  return render(
    <Providers>
      <JobsScreen bookId={bookId} />
    </Providers>,
  );
}

/** Make the jobs list contain ONLY the chapter-generate job for this book. */
function seedChapterJobOnly(job = JOB_CHAPTER_GENERATE_DONE) {
  server.use(
    http.get(`${aiBase}/jobs`, ({ request }) => {
      const url = new URL(request.url);
      const bookId = url.searchParams.get("book_id");
      return HttpResponse.json(bookId === FAROSZ_BOOK.id ? [job] : []);
    }),
  );
}

describe("JobsScreen — chapter_generate job (T5)", () => {
  afterEach(() => {
    vi.useRealTimers();
    pushSpy.mockClear();
  });

  it("renders the chapter-generate progress with the EXACT counts from output_data", async () => {
    seedChapterJobOnly();
    renderScreen();

    // The localized type label identifies the chapter job rendered.
    await screen.findByText(hu.jobs.typeChapterGenerate);

    // output_data: total 5, completed 3, failed 1, skipped [2] →
    // "3/5 kész · 1 sikertelen · 2 kihagyva". Asserting the exact string is the
    // mutation guard: swapping completed↔failed in the render (e.g. "1/5 … 3
    // sikertelen") no longer matches.
    expect(
      screen.getByText(hu.jobs.chapterProgress(3, 5, 1, 2)),
    ).toBeInTheDocument();
    // Belt-and-braces: the precise composed string really is "3/5 kész · 1
    // sikertelen · 2 kihagyva" (pins the formatter, not just the call).
    expect(
      screen.getByText("3/5 kész · 1 sikertelen · 2 kihagyva"),
    ).toBeInTheDocument();

    // A progress bar reflects 3/5 = 60%, with an accessible name.
    const bar = screen.getByRole("progressbar", {
      name: hu.jobs.chapterProgressAria(3, 5),
    });
    expect(bar).toHaveAttribute("aria-valuenow", "60");
  });

  it("a mismatched (completed/failed swapped) render would NOT match the assertion", async () => {
    // Documents the mutation guard directly: the swapped string is absent.
    seedChapterJobOnly();
    renderScreen();
    await screen.findByText(hu.jobs.typeChapterGenerate);
    // The swapped form "1/5 kész · 3 sikertelen · 2 kihagyva" must NOT appear.
    expect(
      screen.queryByText("1/5 kész · 3 sikertelen · 2 kihagyva"),
    ).not.toBeInTheDocument();
  });

  it("lists the job's generated scenes and an Elfogad action approves the right revision", async () => {
    // Capture which revision id the approve endpoint is called with.
    let approvedRevisionId: string | null = null;
    server.use(
      http.post(`${base}/revisions/:revisionId/approve`, ({ params }) => {
        approvedRevisionId = String(params.revisionId);
        return HttpResponse.json({
          id: approvedRevisionId,
          scene_id: SCENE_ACTIVE.id,
          job_id: JOB_CHAPTER_GENERATE_DONE.id,
          content: "Elfogadott jelenet.",
          approved: true,
          revision_type: "generate_scene",
          model_name: "ollama/llama3.2",
          prompt_version: "1.0",
          created_at: "2026-06-15T11:21:00Z",
          updated_at: "2026-06-15T11:21:00Z",
        });
      }),
    );
    seedChapterJobOnly();
    renderScreen();

    // The review list surfaces the scenes from output_data.scenes. The DONE
    // scene (with a pending revision) exposes an Elfogad button.
    const accept = await screen.findByRole("button", {
      name: hu.jobs.chapterSceneAcceptAria(SCENE_ACTIVE.title),
    });
    await userEvent.click(accept);

    // The existing approve endpoint was called for THE DONE scene's revision id
    // (rev-chaptergen-active), NOT some other / the failed scene (which has no
    // revision and therefore no accept button).
    await waitFor(() =>
      expect(approvedRevisionId).toBe("rev-chaptergen-active"),
    );
  });

  it("does NOT offer an accept for a scene whose generation failed (no revision)", async () => {
    seedChapterJobOnly();
    renderScreen();
    await screen.findByText(hu.jobs.typeChapterGenerate);

    // The failed scene (SCENE_FIRST, revision_id null) is listed but has no
    // Elfogad action — only the done scene's revision can be approved.
    const acceptButtons = screen.queryAllByRole("button", {
      name: /Revízió elfogadása/,
    });
    expect(acceptButtons).toHaveLength(1);
  });

  it("the Megnyitás link navigates to the done scene's Write route", async () => {
    seedChapterJobOnly();
    renderScreen();
    const open = await screen.findByRole("button", {
      name: hu.jobs.chapterSceneOpenAria(SCENE_ACTIVE.title),
    });
    await userEvent.click(open);
    // Routes to /konyv/{bookId}/iras/{sceneId} for the right scene — proves the
    // review link targets the scene, not a stale/other id.
    expect(pushSpy).toHaveBeenCalledWith(
      routes.scene(FAROSZ_BOOK.id, SCENE_ACTIVE.id),
    );
  });

  it("polls the list: a pending chapter job that flips to done shows the final progress", async () => {
    // First poll: a PENDING chapter job with 0/5 progress. A later poll: the
    // DONE job with 3/5. Mirrors how the rebuild-hook poll test proves polling
    // advances past a non-terminal state — here the 5s list poll picks up the
    // transition.
    const pending = {
      ...JOB_CHAPTER_GENERATE_DONE,
      status: "pending",
      output_data: {
        total: 5,
        completed: 0,
        failed: 0,
        skipped: [],
        scenes: [],
      },
    };
    let calls = 0;
    server.use(
      http.get(`${aiBase}/jobs`, ({ request }) => {
        calls += 1;
        const url = new URL(request.url);
        const bookId = url.searchParams.get("book_id");
        if (bookId !== FAROSZ_BOOK.id) return HttpResponse.json([]);
        return HttpResponse.json([calls < 2 ? pending : JOB_CHAPTER_GENERATE_DONE]);
      }),
    );
    renderScreen();

    // Initial pending render: 0/5.
    expect(
      await screen.findByText(hu.jobs.chapterProgress(0, 5, 0, 0)),
    ).toBeInTheDocument();

    // After the list re-polls (~5s), the row shows the final done progress.
    await waitFor(
      () =>
        expect(
          screen.getByText(hu.jobs.chapterProgress(3, 5, 1, 2)),
        ).toBeInTheDocument(),
      { timeout: 9000 },
    );
    // It did NOT stop at the first pending poll — the list re-polled and the row
    // re-derived its progress from the fresh output_data.
    expect(calls).toBeGreaterThanOrEqual(2);
  }, 12000);

  it("a11y: the rendered chapter job + review affordance have no violations", async () => {
    seedChapterJobOnly();
    const { container } = renderScreen();
    await screen.findByText(hu.jobs.typeChapterGenerate);
    // The accept button must exist (proves the review UI rendered) before audit.
    await screen.findByRole("button", {
      name: hu.jobs.chapterSceneAcceptAria(SCENE_ACTIVE.title),
    });
    await expectNoA11yViolations(container);
  });
});
