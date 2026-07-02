/**
 * Scene Metadata modal (design-delta Task 4). A centred modal that binds a
 * scene's REAL metadata (title, summary, POV, word count, beat count) and
 * offers: mark-done (PATCH status=complete), open-in-editor (navigate to the
 * Write route), and a beats action. These tests are mutation-proof — they
 * assert the real data renders, that mark-done PATCHes the CORRECT scene id
 * with status=complete (MSW capture), that the button is hidden when already
 * complete, that open-in-editor navigates to the right route, focus-trap + Esc,
 * and a11y on the document (the modal is portalled).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { API_BASE_URL } from "@/lib/api/client";
import { useEditorStore } from "@/lib/stores/editor-store";
import type { PlanScene } from "../types";
import type { BeatRead, SceneRead } from "@/lib/api/types";

// Capture navigation: useNavTo wraps next/navigation's router.push.
const navMock = vi.fn();
vi.mock("@/lib/use-nav-to", () => ({
  useNavTo: () => navMock,
}));

import { SceneMetadataModal } from "../scene-metadata-modal";

const API = `${API_BASE_URL}/api/v1`;

const SCENE_ID = "scene-7";
const CHAPTER_ID = "ch-3";
const BOOK_ID = "book-1";

function makeRaw(overrides: Partial<SceneRead> = {}): SceneRead {
  return {
    id: SCENE_ID,
    chapter_id: CHAPTER_ID,
    title: "A toronyszoba",
    content: null,
    summary: "Eszter felmegy a toronyba, és megtalálja a régi naplót.",
    order_index: 0,
    status: "in_progress",
    word_count: 1234,
    pov_character_id: "char-eszter",
    location_id: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function makeScene(
  overrides: Partial<Omit<PlanScene, "raw">> & { raw?: Partial<SceneRead> } = {},
): PlanScene {
  const { raw: rawOverrides, ...rest } = overrides;
  const raw = makeRaw(rawOverrides);
  return {
    id: raw.id,
    chapterId: raw.chapter_id,
    index: 1,
    title: raw.title,
    summary: raw.summary,
    status: raw.status,
    pov: [{ label: "Eszter", slot: 2 }],
    raw,
    ...rest,
  };
}

function makeBeat(id: string): BeatRead {
  return {
    id,
    scene_id: SCENE_ID,
    description: `beat ${id}`,
    beat_type: null,
    order_index: 0,
    notes: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

/** Default beats handler returns 3 beats for the scene. */
function mockBeats(count: number) {
  server.use(
    http.get(`${API}/scenes/:sceneId/beats`, ({ params }) => {
      expect(params.sceneId).toBe(SCENE_ID);
      return HttpResponse.json(
        Array.from({ length: count }, (_, i) => makeBeat(`b${i}`)),
      );
    }),
  );
}

function renderModal(scene: PlanScene = makeScene()) {
  return renderWithProviders(
    <SceneMetadataModal
      scene={scene}
      bookId={BOOK_ID}
      open
      onOpenChange={() => {}}
    />,
  );
}

describe("SceneMetadataModal", () => {
  beforeEach(() => {
    navMock.mockReset();
    mockBeats(3);
  });

  it("opens with the scene's real metadata", async () => {
    renderModal();

    const dialog = await screen.findByRole("dialog");
    const scoped = within(dialog);

    // Title + summary are the real values, not placeholders.
    expect(
      scoped.getByRole("heading", { name: "A toronyszoba" }),
    ).toBeInTheDocument();
    expect(
      scoped.getByText(
        "Eszter felmegy a toronyba, és megtalálja a régi naplót.",
      ),
    ).toBeInTheDocument();

    // POV name (resolved upstream into scene.pov) shows in the badge + grid.
    expect(scoped.getAllByText("Eszter").length).toBeGreaterThan(0);

    // Real word count (formatted but the digits are present).
    expect(scoped.getByText(/1\D?234/)).toBeInTheDocument();

    // Beat count comes from the live beats query (3), not a placeholder.
    await waitFor(() =>
      expect(scoped.getByText("3")).toBeInTheDocument(),
    );
  });

  it("mark-done PATCHes the correct scene id with status=complete", async () => {
    const captured: { url: string; body: unknown }[] = [];
    server.use(
      http.patch(
        `${API}/chapters/:chapterId/scenes/:sceneId`,
        async ({ request, params }) => {
          captured.push({
            url: `${params.chapterId}/${params.sceneId}`,
            body: await request.json(),
          });
          return HttpResponse.json(makeRaw({ status: "complete" }));
        },
      ),
    );

    const user = userEvent.setup();
    renderModal();

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Késznek jelölöm" }),
    );

    await waitFor(() => expect(captured).toHaveLength(1));
    // Correct scene + chapter id and status=complete in the PATCH body.
    expect(captured[0].url).toBe(`${CHAPTER_ID}/${SCENE_ID}`);
    expect(captured[0].body).toMatchObject({ status: "complete" });

    // Success toast.
    expect(
      await screen.findByText("Jelenet késznek jelölve"),
    ).toBeInTheDocument();
  });

  it("hides the mark-done button when the scene is already complete", async () => {
    renderModal(makeScene({ status: "complete", raw: { status: "complete" } }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: "Késznek jelölöm" }),
    ).not.toBeInTheDocument();
  });

  it("open-in-editor navigates to the scene's Write route", async () => {
    const user = userEvent.setup();
    renderModal();

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Megnyitás a szerkesztőben",
      }),
    );

    expect(navMock).toHaveBeenCalledWith(
      `/konyv/${BOOK_ID}/iras/${SCENE_ID}`,
    );
  });

  it("Beatek repoints the inspector to the Beatek tab and opens the editor", async () => {
    useEditorStore.setState({ inspectorTab: "ai" });
    const user = userEvent.setup();
    renderModal();

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Beatek" }));

    // Navigates to the scene's Write route AND pre-selects the Beatek tab, so
    // the beat editor panel is focused on arrival.
    expect(navMock).toHaveBeenCalledWith(`/konyv/${BOOK_ID}/iras/${SCENE_ID}`);
    expect(useEditorStore.getState().inspectorTab).toBe("beats");
  });

  it("traps focus and closes on Esc", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SceneMetadataModal
        scene={makeScene()}
        bookId={BOOK_ID}
        open
        onOpenChange={onOpenChange}
      />,
    );

    const dialog = await screen.findByRole("dialog");
    // Focus is inside the dialog (focus-trap engaged).
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await user.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("has no a11y violations with the modal open", async () => {
    renderModal();
    await screen.findByRole("dialog");
    // Let the beats query settle so the count renders before scanning.
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    await expectNoA11yViolations(document);
  });
});
