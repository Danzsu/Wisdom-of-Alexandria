/**
 * JobsScreen — `book_generate` job rendering + cancel (V2 book automation).
 * MUTATION-PROOF: asserts the EXACT book-level counts from `output_data`, the
 * per-chapter collapsible groups, that Elfogad approves the RIGHT revision id,
 * and that cancel POSTs to the RIGHT job id only after an explicit confirm.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Providers } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, API_BASE_URL } from "@/lib/api/client";
import {
  CHAPTER_ONE,
  CHAPTER_TWO,
  FAROSZ_BOOK,
  JOB_BOOK_GENERATE_RUNNING,
  JOB_CHAPTER_GENERATE_DONE,
  SCENE_ACTIVE,
  SCENE_FIRST,
} from "@/test/msw/fixtures";
import { expectNoA11yViolations } from "@/test/a11y";
import { hu } from "@/lib/i18n/hu";
import type { GenerationJobRead } from "@/lib/api/ai-types";
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

/** Make the jobs list contain ONLY the given jobs for the Fárosz book. */
function seedJobs(jobs: GenerationJobRead[]) {
  server.use(
    http.get(`${aiBase}/jobs`, ({ request }) => {
      const url = new URL(request.url);
      const bookId = url.searchParams.get("book_id");
      return HttpResponse.json(bookId === FAROSZ_BOOK.id ? jobs : []);
    }),
  );
}

describe("JobsScreen — book_generate job (V2)", () => {
  afterEach(() => {
    pushSpy.mockClear();
  });

  it("renders the book-level progress with the EXACT counts from output_data", async () => {
    seedJobs([JOB_BOOK_GENERATE_RUNNING]);
    renderScreen();

    // The localized type label identifies the book job rendered.
    await screen.findByText(hu.jobs.typeBookGenerate);

    // output_data: 1 of 2 chapters completed → "1/2 fejezet kész"; scenes:
    // completed 2, total 3, failed 1, skipped [] → "2/3 kész · 1 sikertelen ·
    // 0 kihagyva". Asserting the exact composed strings is the mutation guard
    // (swapping completed↔failed or chapter↔scene counts stops matching).
    expect(
      screen.getByText(hu.jobs.bookChaptersProgress(1, 2)),
    ).toBeInTheDocument();
    expect(screen.getByText("1/2 fejezet kész")).toBeInTheDocument();
    expect(
      screen.getByText(hu.jobs.chapterProgress(2, 3, 1, 0)),
    ).toBeInTheDocument();

    // The progress bar reflects 2/3 ≈ 67%, with an accessible name.
    const bar = screen.getByRole("progressbar", {
      name: hu.jobs.bookProgressAria(2, 3),
    });
    expect(bar).toHaveAttribute("aria-valuenow", "67");

    // The context line surfaces the book linkage (the new book_id column).
    expect(
      screen.getByText(`${hu.jobs.contextBook} · ${FAROSZ_BOOK.id}`),
    ).toBeInTheDocument();
  });

  it("renders one collapsible group per chapter (real titles) that hides its scene rows when collapsed", async () => {
    seedJobs([JOB_BOOK_GENERATE_RUNNING]);
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(hu.jobs.typeBookGenerate);

    // Both chapters' groups render with their REAL titles (resolved from the
    // book's chapter list, not the raw ids).
    const toggleOne = await screen.findByRole("button", {
      name: hu.jobs.bookChapterToggleAria(CHAPTER_ONE.title),
    });
    const toggleTwo = screen.getByRole("button", {
      name: hu.jobs.bookChapterToggleAria(CHAPTER_TWO.title),
    });
    expect(toggleOne).toHaveAttribute("aria-expanded", "true");
    expect(toggleTwo).toHaveAttribute("aria-expanded", "true");

    // Expanded: chapter I's done scene row is visible (real scene title).
    expect(await screen.findByText(SCENE_FIRST.title)).toBeInTheDocument();

    // Collapse chapter I → its scene rows disappear; chapter II's remain.
    await user.click(toggleOne);
    expect(toggleOne).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(screen.queryByText(SCENE_FIRST.title)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(SCENE_ACTIVE.title)).toBeInTheDocument();
  });

  it("Elfogad approves EXACTLY the clicked scene's revision id", async () => {
    let approvedRevisionId: string | null = null;
    server.use(
      http.post(`${base}/revisions/:revisionId/approve`, ({ params }) => {
        approvedRevisionId = String(params.revisionId);
        return HttpResponse.json({
          id: approvedRevisionId,
          scene_id: SCENE_ACTIVE.id,
          job_id: JOB_BOOK_GENERATE_RUNNING.id,
          content: "Elfogadott jelenet.",
          approved: true,
          revision_type: "generate_scene",
          model_name: "ollama/llama3.2",
          prompt_version: "1.0",
          created_at: "2026-06-15T11:26:00Z",
          updated_at: "2026-06-15T11:26:00Z",
        });
      }),
    );
    seedJobs([JOB_BOOK_GENERATE_RUNNING]);
    renderScreen();

    // Chapter II's done scene (SCENE_ACTIVE) exposes an Elfogad button; the
    // approve must hit ITS revision (rev-bookgen-active), not chapter I's.
    const accept = await screen.findByRole("button", {
      name: hu.jobs.chapterSceneAcceptAria(SCENE_ACTIVE.title),
    });
    await userEvent.click(accept);

    await waitFor(() =>
      expect(approvedRevisionId).toBe("rev-bookgen-active"),
    );
  });

  it("does NOT offer an accept for the failed scene (no revision)", async () => {
    seedJobs([JOB_BOOK_GENERATE_RUNNING]);
    renderScreen();
    await screen.findByText(hu.jobs.typeBookGenerate);

    // Exactly TWO accept buttons — the two done scenes with pending revisions;
    // the failed scene (revision_id null) exposes none.
    await screen.findByRole("button", {
      name: hu.jobs.chapterSceneAcceptAria(SCENE_ACTIVE.title),
    });
    const acceptButtons = screen.getAllByRole("button", {
      name: /Revízió elfogadása/,
    });
    expect(acceptButtons).toHaveLength(2);
  });

  it("cancel asks for confirmation, then POSTs to EXACTLY the running book job's cancel endpoint", async () => {
    let cancelledJobId: string | null = null;
    server.use(
      http.post(`${aiBase}/jobs/:jobId/cancel`, ({ params }) => {
        cancelledJobId = String(params.jobId);
        return HttpResponse.json({
          ...JOB_BOOK_GENERATE_RUNNING,
          status: "cancelled",
        });
      }),
    );
    seedJobs([JOB_BOOK_GENERATE_RUNNING]);
    const user = userEvent.setup();
    renderScreen();

    // The running book job exposes a cancel affordance.
    const cancelTrigger = await screen.findByRole("button", {
      name: hu.jobs.cancelAria(hu.jobs.typeBookGenerate),
    });
    await user.click(cancelTrigger);

    // A ConfirmDialog opens — nothing is POSTed yet.
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(hu.jobs.cancelConfirmTitle),
    ).toBeInTheDocument();
    expect(cancelledJobId).toBeNull();

    // Confirm → the cancel endpoint is hit with THIS job's id.
    await user.click(
      within(dialog).getByRole("button", { name: hu.jobs.cancelAction }),
    );
    await waitFor(() =>
      expect(cancelledJobId).toBe(JOB_BOOK_GENERATE_RUNNING.id),
    );
  });

  it("dismissing the confirm does NOT cancel", async () => {
    let cancelCalls = 0;
    server.use(
      http.post(`${aiBase}/jobs/:jobId/cancel`, () => {
        cancelCalls += 1;
        return HttpResponse.json({
          ...JOB_BOOK_GENERATE_RUNNING,
          status: "cancelled",
        });
      }),
    );
    seedJobs([JOB_BOOK_GENERATE_RUNNING]);
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      await screen.findByRole("button", {
        name: hu.jobs.cancelAria(hu.jobs.typeBookGenerate),
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: hu.kit.cancel }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(cancelCalls).toBe(0);
  });

  it("offers cancel for a PENDING chapter job too, POSTing to ITS id", async () => {
    const pendingChapterJob: GenerationJobRead = {
      ...JOB_CHAPTER_GENERATE_DONE,
      id: "job-chaptergen-pending",
      status: "pending",
      output_data: { total: 2, completed: 0, failed: 0, skipped: [], scenes: [] },
    };
    let cancelledJobId: string | null = null;
    server.use(
      http.post(`${aiBase}/jobs/:jobId/cancel`, ({ params }) => {
        cancelledJobId = String(params.jobId);
        return HttpResponse.json({ ...pendingChapterJob, status: "cancelled" });
      }),
    );
    seedJobs([pendingChapterJob]);
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      await screen.findByRole("button", {
        name: hu.jobs.cancelAria(hu.jobs.typeChapterGenerate),
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: hu.jobs.cancelAction }),
    );
    await waitFor(() =>
      expect(cancelledJobId).toBe("job-chaptergen-pending"),
    );
  });

  it("offers NO cancel for a terminal (done) job", async () => {
    seedJobs([JOB_CHAPTER_GENERATE_DONE]);
    renderScreen();
    await screen.findByText(hu.jobs.typeChapterGenerate);

    expect(
      screen.queryByRole("button", {
        name: hu.jobs.cancelAria(hu.jobs.typeChapterGenerate),
      }),
    ).not.toBeInTheDocument();
  });

  it("a11y: the rendered book job (groups + cancel + review rows) has no violations", async () => {
    seedJobs([JOB_BOOK_GENERATE_RUNNING]);
    const { container } = renderScreen();
    await screen.findByText(hu.jobs.typeBookGenerate);
    await screen.findByRole("button", {
      name: hu.jobs.chapterSceneAcceptAria(SCENE_ACTIVE.title),
    });
    await expectNoA11yViolations(container);
  });
});
