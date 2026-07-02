/**
 * "Fejezet kész" signal on the chapter-generate job row (gap-fix #4).
 *
 * After chapter automation the review list stayed forever, even once every
 * generated scene's revision had been human-approved. The row now derives the
 * per-scene approved state from the REAL revision endpoint
 * (`GET /revisions?scene_id=` → `approved`) and, when EVERY scene is done AND
 * every revision approved, replaces the pending review list with a clear
 * "Fejezet kész — minden jelenet jóváhagyva" success state. Honesty guards:
 * a pending revision OR a failed scene must keep the banner away.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  SCENE_FIRST,
} from "@/test/msw/fixtures";
import { expectNoA11yViolations } from "@/test/a11y";
import { hu } from "@/lib/i18n/hu";
import { JobsScreen } from "../jobs-screen";
import type { GenerationJobRead, RevisionRead } from "@/lib/api/ai-types";

const aiBase = `${AI_BASE_URL}/api/v1`;
const base = `${API_BASE_URL}/api/v1`;

vi.mock("next/navigation", () => ({
  usePathname: () => "/konyv/x/feladatok",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const REV_A = "rev-done-active";
const REV_B = "rev-done-first";

/** A chapter job where EVERY scene generated successfully (2/2 done). */
const JOB_ALL_SCENES_DONE: GenerationJobRead = {
  ...JOB_CHAPTER_GENERATE_DONE,
  id: "job-chaptergen-all-done",
  output_data: {
    total: 2,
    completed: 2,
    failed: 0,
    skipped: [],
    scenes: [
      {
        scene_id: SCENE_ACTIVE.id,
        revision_id: REV_A,
        status: "done",
        warning_count: 0,
      },
      {
        scene_id: SCENE_FIRST.id,
        revision_id: REV_B,
        status: "done",
        warning_count: 0,
      },
    ],
  },
};

const REVISION_SCENE: Record<string, string> = {
  [REV_A]: SCENE_ACTIVE.id,
  [REV_B]: SCENE_FIRST.id,
};

function makeJobRevision(revisionId: string, approved: boolean): RevisionRead {
  return {
    id: revisionId,
    scene_id: REVISION_SCENE[revisionId] ?? SCENE_ACTIVE.id,
    job_id: JOB_ALL_SCENES_DONE.id,
    content: "Generált jelenetszöveg.",
    approved,
    revision_type: "generate_scene",
    model_name: "ollama/llama3.2",
    prompt_version: "1.0",
    created_at: "2026-06-15T11:21:00Z",
    updated_at: "2026-06-15T11:21:00Z",
  };
}

/** Jobs list = only the given chapter job (scoped to the Fárosz book). */
function seedJob(job: GenerationJobRead) {
  server.use(
    http.get(`${aiBase}/jobs`, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json(
        url.searchParams.get("book_id") === FAROSZ_BOOK.id ? [job] : [],
      );
    }),
  );
}

/**
 * Stateful revision store: GET /revisions?scene_id= serves each scene's
 * revision with its LIVE approved flag; POST /revisions/{id}/approve flips it —
 * mirroring the real backend so the "last approve flips the banner" flow is
 * end-to-end through MSW.
 */
function seedRevisions(initial: Record<string, boolean>) {
  const approved = new Map(Object.entries(initial));
  server.use(
    http.get(`${base}/revisions`, ({ request }) => {
      const sceneId = new URL(request.url).searchParams.get("scene_id");
      const list = [...approved.entries()]
        .filter(([revId]) => REVISION_SCENE[revId] === sceneId)
        .map(([revId, isApproved]) => makeJobRevision(revId, isApproved));
      return HttpResponse.json(list);
    }),
    http.post(`${base}/revisions/:revisionId/approve`, ({ params }) => {
      const revId = String(params.revisionId);
      approved.set(revId, true);
      return HttpResponse.json(makeJobRevision(revId, true));
    }),
  );
  return approved;
}

function renderScreen() {
  return render(
    <Providers>
      <JobsScreen bookId={FAROSZ_BOOK.id} />
    </Providers>,
  );
}

describe("Chapter job — 'Fejezet kész' success signal", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the success state when EVERY scene is done and every revision approved", async () => {
    seedJob(JOB_ALL_SCENES_DONE);
    seedRevisions({ [REV_A]: true, [REV_B]: true });
    renderScreen();

    await screen.findByText(hu.jobs.typeChapterGenerate);
    expect(
      await screen.findByText(hu.jobs.chapterDoneAll),
    ).toBeInTheDocument();

    // The pending review list is REPLACED — no accept buttons, no list heading.
    expect(
      screen.queryByRole("button", { name: /Revízió elfogadása/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(hu.jobs.chapterScenesHeading),
    ).not.toBeInTheDocument();
  });

  it("does NOT show the success state while ANY revision is still pending", async () => {
    seedJob(JOB_ALL_SCENES_DONE);
    seedRevisions({ [REV_A]: true, [REV_B]: false });
    renderScreen();

    await screen.findByText(hu.jobs.typeChapterGenerate);
    // The review list is present with EXACTLY ONE pending accept (REV_B)…
    await screen.findByText(hu.jobs.chapterScenesHeading);
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Revízió elfogadása/ }),
      ).toHaveLength(1),
    );
    // …the server-approved scene shows its approved badge instead of a button…
    expect(screen.getByText(hu.jobs.chapterSceneApproved)).toBeInTheDocument();
    // …and the banner is absent (mutation guard: showing it early fails here).
    expect(screen.queryByText(hu.jobs.chapterDoneAll)).not.toBeInTheDocument();
  });

  it("does NOT show the success state when a scene FAILED, even with every revision approved", async () => {
    // The original fixture: one done scene (with revision) + one failed scene.
    seedJob(JOB_CHAPTER_GENERATE_DONE);
    seedRevisions({ "rev-chaptergen-active": true });
    server.use(
      http.get(`${base}/revisions`, ({ request }) => {
        const sceneId = new URL(request.url).searchParams.get("scene_id");
        return HttpResponse.json(
          sceneId === SCENE_ACTIVE.id
            ? [
                {
                  ...makeJobRevision(REV_A, true),
                  id: "rev-chaptergen-active",
                },
              ]
            : [],
        );
      }),
    );
    renderScreen();

    await screen.findByText(hu.jobs.typeChapterGenerate);
    await screen.findByText(hu.jobs.chapterScenesHeading);
    // "Minden jelenet jóváhagyva" would be dishonest with a failed scene.
    expect(screen.queryByText(hu.jobs.chapterDoneAll)).not.toBeInTheDocument();
    expect(screen.getByText(hu.jobs.chapterSceneFailed)).toBeInTheDocument();
  });

  it("approving the LAST pending revision flips the row to the success state", async () => {
    seedJob(JOB_ALL_SCENES_DONE);
    seedRevisions({ [REV_A]: true, [REV_B]: false });
    renderScreen();

    const accept = await screen.findByRole("button", {
      name: /Revízió elfogadása/,
    });
    expect(screen.queryByText(hu.jobs.chapterDoneAll)).not.toBeInTheDocument();

    await userEvent.click(accept);

    // The approve invalidates the scene's revision list; the refetch reports
    // approved=true for every revision → the banner appears live.
    expect(
      await screen.findByText(hu.jobs.chapterDoneAll),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Revízió elfogadása/ }),
    ).not.toBeInTheDocument();
  });

  it("a11y: the success state has no violations", async () => {
    seedJob(JOB_ALL_SCENES_DONE);
    seedRevisions({ [REV_A]: true, [REV_B]: true });
    const { container } = renderScreen();
    await screen.findByText(hu.jobs.chapterDoneAll);
    await expectNoA11yViolations(container);
  });
});
