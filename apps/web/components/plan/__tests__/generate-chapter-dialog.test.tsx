/**
 * GenerateChapterDialog (chapter automation, T4) — the "Fejezet generálása"
 * selection modal. These tests are MUTATION-PROOF: they assert the REAL effects
 * (which rows are checked by default, the EXACT scene_ids + run_continuity in the
 * captured POST body, the disabled Generálás), not just that the modal renders.
 *
 * Fixtures: a chapter with three scenes —
 *   - sceneEmpty   : empty (word_count 0) + 2 beats   → checked by default
 *   - sceneFull    : non-empty (word_count 42) + 1 beat → rendered, UNCHECKED
 *   - sceneNoBeats : empty but 0 beats                → checkbox disabled
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
import type { BeatRead, SceneRead } from "@/lib/api/types";
import type { GenerationJobRead } from "@/lib/api/ai-types";
import { GenerateChapterDialog } from "../generate-chapter-dialog";

const apiBase = `${API_BASE_URL}/api/v1`;
const aiBase = `${AI_BASE_URL}/api/v1`;

const CHAPTER_ID = "chap-gen-1111";
const NOW = "2026-06-26T10:00:00Z";

const sceneEmpty: SceneRead = {
  id: "scene-empty-1",
  chapter_id: CHAPTER_ID,
  title: "1. jelenet — Üres + beat",
  content: "",
  summary: null,
  order_index: 0,
  status: "draft",
  word_count: 0,
  pov_character_id: null,
  location_id: null,
  created_at: NOW,
  updated_at: NOW,
};

const sceneFull: SceneRead = {
  id: "scene-full-2",
  chapter_id: CHAPTER_ID,
  title: "2. jelenet — Van szövege + beat",
  content: "A kikötő csendes volt, és a lámpás fénye megremegett a vízen.",
  summary: null,
  order_index: 1,
  status: "draft",
  word_count: 42,
  pov_character_id: null,
  location_id: null,
  created_at: NOW,
  updated_at: NOW,
};

const sceneNoBeats: SceneRead = {
  id: "scene-nobeats-3",
  chapter_id: CHAPTER_ID,
  title: "3. jelenet — Nincs beat",
  content: "",
  summary: null,
  order_index: 2,
  status: "draft",
  word_count: 0,
  pov_character_id: null,
  location_id: null,
  created_at: NOW,
  updated_at: NOW,
};

const SCENES = [sceneEmpty, sceneFull, sceneNoBeats];

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

/** Beats per scene: empty→2, full→1, no-beats→0. */
const BEATS_BY_SCENE: Record<string, BeatRead[]> = {
  [sceneEmpty.id]: [makeBeat(sceneEmpty.id, 0), makeBeat(sceneEmpty.id, 1)],
  [sceneFull.id]: [makeBeat(sceneFull.id, 0)],
  [sceneNoBeats.id]: [],
};

function makeQueuedJob(): GenerationJobRead {
  return {
    id: "job-chapter-gen-1",
    project_id: null,
    scene_id: null,
    chapter_id: CHAPTER_ID,
    book_id: null,
    job_type: "chapter_generate",
    status: "pending",
    model_name: null,
    prompt_version: null,
    input_data: {},
    output_data: null,
    error_message: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

/** Install the happy-path data handlers (scene list + per-scene beats). */
function installDataHandlers() {
  server.use(
    http.get(`${apiBase}/chapters/${CHAPTER_ID}/scenes`, () =>
      HttpResponse.json(SCENES),
    ),
    http.get(`${apiBase}/scenes/:sceneId/beats`, ({ params }) =>
      HttpResponse.json(BEATS_BY_SCENE[String(params.sceneId)] ?? []),
    ),
  );
}

function renderOpen() {
  return render(
    <GenerateChapterDialog
      chapterId={CHAPTER_ID}
      chapterTitle="I. fejezet"
      open
      onOpenChange={() => {}}
    />,
    { wrapper: ({ children }) => <Providers>{children}</Providers> },
  );
}

/** Find the checkbox for a scene by its row label (returns the role=checkbox). */
function checkboxFor(title: string): HTMLElement {
  const label = screen.getByText(title).closest("label");
  if (!label) throw new Error(`No label for ${title}`);
  const box = within(label).getByRole("checkbox");
  return box;
}

beforeEach(() => {
  installDataHandlers();
});

describe("GenerateChapterDialog — default selection", () => {
  it("pre-checks empty+beats, leaves non-empty UNchecked, disables no-beats", async () => {
    renderOpen();

    // Wait for the rows to render (beats resolved).
    await screen.findByText(sceneEmpty.title);
    await screen.findByText(sceneFull.title);
    await screen.findByText(sceneNoBeats.title);

    const emptyBox = checkboxFor(sceneEmpty.title);
    const fullBox = checkboxFor(sceneFull.title);
    const noBeatsBox = checkboxFor(sceneNoBeats.title);

    // empty + beats → CHECKED by default.
    await waitFor(() =>
      expect(emptyBox).toHaveAttribute("aria-checked", "true"),
    );
    // non-empty + beats → rendered, UNCHECKED (the mutation guard: a bug that
    // pre-checks non-empty scenes flips this to "true" and fails here).
    expect(fullBox).toHaveAttribute("aria-checked", "false");
    // no beats → checkbox DISABLED (cannot be selected).
    expect(noBeatsBox).toBeDisabled();

    // The hints are surfaced per row.
    expect(screen.getByText(hu.chapterGen.hintHasText)).toBeInTheDocument();
    expect(screen.getByText(hu.chapterGen.hintNoBeats)).toBeInTheDocument();
  });
});

describe("GenerateChapterDialog — submit body", () => {
  it("POSTs exactly the checked scene_ids (+ run_continuity) — including a checked non-empty scene, minus the unchecked default", async () => {
    let capturedBody: { scene_ids?: string[]; run_continuity?: boolean } = {};
    let capturedUrl = "";
    server.use(
      http.post(
        `${aiBase}/ai/chapters/:chapterId/generate`,
        async ({ request }) => {
          capturedUrl = request.url;
          capturedBody = (await request.json()) as typeof capturedBody;
          return HttpResponse.json(makeQueuedJob(), { status: 202 });
        },
      ),
    );

    const user = userEvent.setup();
    renderOpen();
    await screen.findByText(sceneFull.title);

    const emptyBox = checkboxFor(sceneEmpty.title);
    await waitFor(() =>
      expect(emptyBox).toHaveAttribute("aria-checked", "true"),
    );

    // Check the non-empty scene (opt-in) AND uncheck the empty default.
    await user.click(checkboxFor(sceneFull.title));
    await user.click(emptyBox);
    // Flip the continuity toggle ON.
    await user.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(checkboxFor(sceneFull.title)).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );

    await user.click(
      screen.getByRole("button", { name: hu.chapterGen.submit }),
    );

    await waitFor(() => expect(capturedBody.scene_ids).toBeDefined());

    // EXACT set: only the non-empty scene we checked (the empty default was
    // removed; the no-beats scene was never selectable).
    expect(new Set(capturedBody.scene_ids)).toEqual(new Set([sceneFull.id]));
    expect(capturedBody.run_continuity).toBe(true);
    // Hit the AI-service endpoint for THIS chapter.
    expect(capturedUrl).toContain(
      `/ai/chapters/${CHAPTER_ID}/generate`,
    );
  });

  it("submits the empty default alone with run_continuity false when nothing is changed", async () => {
    let capturedBody: { scene_ids?: string[]; run_continuity?: boolean } = {};
    server.use(
      http.post(`${aiBase}/ai/chapters/:chapterId/generate`, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json(makeQueuedJob(), { status: 202 });
      }),
    );

    const user = userEvent.setup();
    renderOpen();
    await screen.findByText(sceneEmpty.title);
    await waitFor(() =>
      expect(checkboxFor(sceneEmpty.title)).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );

    await user.click(
      screen.getByRole("button", { name: hu.chapterGen.submit }),
    );

    await waitFor(() => expect(capturedBody.scene_ids).toBeDefined());
    expect(new Set(capturedBody.scene_ids)).toEqual(new Set([sceneEmpty.id]));
    expect(capturedBody.run_continuity).toBe(false);
  });
});

describe("GenerateChapterDialog — submit gating", () => {
  it("disables Generálás when nothing is checked", async () => {
    const user = userEvent.setup();
    renderOpen();
    await screen.findByText(sceneEmpty.title);

    const submit = screen.getByRole("button", { name: hu.chapterGen.submit });
    // Initially the empty default is checked → enabled.
    await waitFor(() => expect(submit).toBeEnabled());

    // Uncheck the only default → nothing checked → disabled.
    await user.click(checkboxFor(sceneEmpty.title));
    await waitFor(() => expect(submit).toBeDisabled());
  });
});

describe("GenerateChapterDialog — a11y", () => {
  it("has no axe violations with the modal open (portalled overlay)", async () => {
    renderOpen();
    await screen.findByText(sceneEmpty.title);
    await expectNoA11yViolations(document);
  });

  it("closes on Esc (the kit modal traps focus + wires Escape)", async () => {
    let openState = true;
    const onOpenChange = (next: boolean) => {
      openState = next;
    };
    const user = userEvent.setup();
    render(
      <GenerateChapterDialog
        chapterId={CHAPTER_ID}
        chapterTitle="I. fejezet"
        open
        onOpenChange={onOpenChange}
      />,
      { wrapper: ({ children }) => <Providers>{children}</Providers> },
    );
    await screen.findByText(sceneEmpty.title);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(openState).toBe(false));
  });
});
