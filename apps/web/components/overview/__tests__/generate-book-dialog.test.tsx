/**
 * GenerateBookDialog (book automation, V2) — the "Könyv generálása" selection
 * modal. These tests are MUTATION-PROOF: they assert the REAL effects (which
 * chapter rows are checked by default, the EXACT chapter_ids + run_continuity
 * in the captured POST body, the disabled Generálás), not just that the modal
 * renders.
 *
 * Fixtures: a book with three chapters —
 *   - chGeneratable : 1 empty scene w/ beats + 1 full scene → 1 generatable → pre-checked
 *   - chBlocked     : full scene w/ beat + empty scene w/o beats → 0 → disabled + hint
 *   - chDouble      : 2 empty scenes w/ beats → 2 generatable → pre-checked
 */
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL, AI_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { hu } from "@/lib/i18n/hu";
import { expectNoA11yViolations } from "@/test/a11y";
import type { BeatRead, ChapterRead, SceneRead } from "@/lib/api/types";
import { GenerateBookDialog } from "../generate-book-dialog";

const apiBase = `${API_BASE_URL}/api/v1`;
const aiBase = `${AI_BASE_URL}/api/v1`;

const BOOK_ID = "book-gen-1111";
const NOW = "2026-07-01T10:00:00Z";

function chapter(id: string, title: string, order: number): ChapterRead {
  return {
    id,
    book_id: BOOK_ID,
    title,
    summary: null,
    order_index: order,
    status: "draft",
    created_at: NOW,
    updated_at: NOW,
  };
}

const chGeneratable = chapter("ch-gen-a", "I. fejezet — A kapu", 0);
const chBlocked = chapter("ch-gen-b", "II. fejezet — Zárva", 1);
const chDouble = chapter("ch-gen-c", "III. fejezet — Kettős", 2);
const CHAPTERS = [chGeneratable, chBlocked, chDouble];

function scene(
  id: string,
  chapterId: string,
  content: string | null,
  wordCount: number,
  order: number,
): SceneRead {
  return {
    id,
    chapter_id: chapterId,
    title: `Jelenet ${id}`,
    content,
    summary: null,
    order_index: order,
    status: "draft",
    word_count: wordCount,
    pov_character_id: null,
    location_id: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

const SCENES_BY_CHAPTER: Record<string, SceneRead[]> = {
  [chGeneratable.id]: [
    scene("sa-empty", chGeneratable.id, "", 0, 0),
    scene("sa-full", chGeneratable.id, "Már kész szöveg.", 3, 1),
  ],
  [chBlocked.id]: [
    scene("sb-full", chBlocked.id, "Van szövege.", 2, 0),
    scene("sb-nobeats", chBlocked.id, "", 0, 1),
  ],
  [chDouble.id]: [
    scene("sc-one", chDouble.id, "", 0, 0),
    scene("sc-two", chDouble.id, null, 0, 1),
  ],
};

function makeBeat(sceneId: string, n: number): BeatRead {
  return {
    id: `${sceneId}-beat-${n}`,
    scene_id: sceneId,
    description: `Beat ${n}`,
    beat_type: null,
    order_index: n,
    notes: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

/** Beats: every scene has one beat EXCEPT sb-nobeats (0). */
const BEATS_BY_SCENE: Record<string, BeatRead[]> = {
  "sa-empty": [makeBeat("sa-empty", 0)],
  "sa-full": [makeBeat("sa-full", 0)],
  "sb-full": [makeBeat("sb-full", 0)],
  "sb-nobeats": [],
  "sc-one": [makeBeat("sc-one", 0)],
  "sc-two": [makeBeat("sc-two", 0)],
};

/** Install the happy-path data handlers (chapters + scenes + beats). */
function installDataHandlers() {
  server.use(
    http.get(`${apiBase}/books/${BOOK_ID}/chapters`, () =>
      HttpResponse.json(CHAPTERS),
    ),
    http.get(`${apiBase}/chapters/:chapterId/scenes`, ({ params }) =>
      HttpResponse.json(SCENES_BY_CHAPTER[String(params.chapterId)] ?? []),
    ),
    http.get(`${apiBase}/scenes/:sceneId/beats`, ({ params }) =>
      HttpResponse.json(BEATS_BY_SCENE[String(params.sceneId)] ?? []),
    ),
  );
}

function renderOpen() {
  return render(
    <GenerateBookDialog bookId={BOOK_ID} open onOpenChange={() => {}} />,
    { wrapper: ({ children }) => <Providers>{children}</Providers> },
  );
}

/** Find the checkbox for a chapter by its row label. */
function checkboxFor(title: string): HTMLElement {
  const label = screen.getByText(title).closest("label");
  if (!label) throw new Error(`No label for ${title}`);
  return within(label).getByRole("checkbox");
}

beforeEach(() => {
  installDataHandlers();
});

describe("GenerateBookDialog — default selection", () => {
  it("pre-checks generatable chapters, disables 0-generatable with a hint", async () => {
    renderOpen();

    await screen.findByText(chGeneratable.title);
    await screen.findByText(chBlocked.title);
    await screen.findByText(chDouble.title);

    // Generatable chapters → CHECKED by default (both of them).
    await waitFor(() =>
      expect(checkboxFor(chGeneratable.title)).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(checkboxFor(chDouble.title)).toHaveAttribute("aria-checked", "true");
    // 0-generatable → DISABLED + unchecked (the mutation guard: pre-checking
    // or enabling it flips one of these and fails here).
    const blockedBox = checkboxFor(chBlocked.title);
    expect(blockedBox).toBeDisabled();
    expect(blockedBox).toHaveAttribute("aria-checked", "false");

    // The per-row hints carry the EXACT generatable counts.
    expect(
      screen.getByText(hu.bookGen.hintGeneratable(1)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(hu.bookGen.hintGeneratable(2)),
    ).toBeInTheDocument();
    expect(screen.getByText(hu.bookGen.hintNone)).toBeInTheDocument();
  });
});

describe("GenerateBookDialog — submit body", () => {
  it("POSTs exactly the checked chapter_ids + run_continuity to the book's endpoint", async () => {
    let capturedBody: { chapter_ids?: string[]; run_continuity?: boolean } = {};
    let capturedUrl = "";
    server.use(
      http.post(
        `${aiBase}/ai/books/:bookId/generate`,
        async ({ request }) => {
          capturedUrl = request.url;
          capturedBody = (await request.json()) as typeof capturedBody;
          return HttpResponse.json(
            {
              id: "job-bookgen-test",
              project_id: null,
              scene_id: null,
              chapter_id: null,
              book_id: BOOK_ID,
              job_type: "book_generate",
              status: "pending",
              model_name: null,
              prompt_version: null,
              input_data: {},
              output_data: null,
              error_message: null,
              created_at: NOW,
              updated_at: NOW,
            },
            { status: 202 },
          );
        },
      ),
    );

    const user = userEvent.setup();
    renderOpen();
    await screen.findByText(chDouble.title);
    await waitFor(() =>
      expect(checkboxFor(chGeneratable.title)).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );

    // Uncheck the first generatable default; flip the continuity toggle ON.
    await user.click(checkboxFor(chGeneratable.title));
    await user.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(checkboxFor(chGeneratable.title)).toHaveAttribute(
        "aria-checked",
        "false",
      ),
    );

    await user.click(screen.getByRole("button", { name: hu.bookGen.submit }));

    await waitFor(() => expect(capturedBody.chapter_ids).toBeDefined());
    // EXACT set: only the remaining checked chapter — the unchecked default is
    // gone and the disabled 0-generatable chapter was never selectable.
    expect(capturedBody.chapter_ids).toEqual([chDouble.id]);
    expect(capturedBody.run_continuity).toBe(true);
    // Hit the AI-service endpoint for THIS book.
    expect(capturedUrl).toContain(`/ai/books/${BOOK_ID}/generate`);
  });

  it("submits both generatable defaults in listed order with run_continuity false when nothing is changed", async () => {
    let capturedBody: { chapter_ids?: string[]; run_continuity?: boolean } = {};
    server.use(
      http.post(`${aiBase}/ai/books/:bookId/generate`, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json(
          {
            id: "job-bookgen-test-2",
            project_id: null,
            scene_id: null,
            chapter_id: null,
            book_id: BOOK_ID,
            job_type: "book_generate",
            status: "pending",
            model_name: null,
            prompt_version: null,
            input_data: {},
            output_data: null,
            error_message: null,
            created_at: NOW,
            updated_at: NOW,
          },
          { status: 202 },
        );
      }),
    );

    const user = userEvent.setup();
    renderOpen();
    await screen.findByText(chDouble.title);
    await waitFor(() =>
      expect(checkboxFor(chDouble.title)).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );

    await user.click(screen.getByRole("button", { name: hu.bookGen.submit }));

    await waitFor(() => expect(capturedBody.chapter_ids).toBeDefined());
    // BOTH generatable chapters, in their listed (order_index) order — the
    // 0-generatable chapter is excluded.
    expect(capturedBody.chapter_ids).toEqual([chGeneratable.id, chDouble.id]);
    expect(capturedBody.run_continuity).toBe(false);
  });
});

describe("GenerateBookDialog — submit gating", () => {
  it("disables Generálás when no chapter is checked", async () => {
    const user = userEvent.setup();
    renderOpen();
    await screen.findByText(chDouble.title);

    const submit = screen.getByRole("button", { name: hu.bookGen.submit });
    await waitFor(() => expect(submit).toBeEnabled());

    // Uncheck both defaults → nothing checked → disabled.
    await user.click(checkboxFor(chGeneratable.title));
    await user.click(checkboxFor(chDouble.title));
    await waitFor(() => expect(submit).toBeDisabled());
  });
});

describe("GenerateBookDialog — a11y", () => {
  it("has no axe violations with the modal open (portalled overlay)", async () => {
    renderOpen();
    await screen.findByText(chGeneratable.title);
    await expectNoA11yViolations(document);
  });
});
