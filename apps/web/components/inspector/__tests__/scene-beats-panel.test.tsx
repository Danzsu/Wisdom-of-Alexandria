/**
 * SceneBeatsPanel — the full scene-level beat editor behind the inspector's
 * "Beatek" tab: ordered list + add + edit-in-place + delete (+ drag-reorder,
 * which is covered separately in scene-beats-panel-dnd.test.tsx because real
 * pointer drags are flaky in jsdom).
 *
 * Mutation-proof: the MSW handlers here are STATEFUL — GET returns the current
 * seeded list and every mutation (POST/PATCH/DELETE) both CAPTURES the exact
 * request (URL params + body) and updates that list. The assertions therefore
 * prove (a) the right scene-scoped payload was sent for the RIGHT beat id and
 * (b) the panel re-fetches through query invalidation (the UI reflects the
 * post-mutation server state, not an optimistic illusion).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { API_BASE_URL } from "@/lib/api/client";
import { hu } from "@/lib/i18n/hu";
import type { BeatRead } from "@/lib/api/types";
import { SceneBeatsPanel } from "../scene-beats-panel";

const API = `${API_BASE_URL}/api/v1`;
const SCENE_ID = "scene-beats-1";

function makeBeat(overrides: Partial<BeatRead> & { id: string }): BeatRead {
  return {
    scene_id: SCENE_ID,
    description: `beat ${overrides.id}`,
    beat_type: null,
    order_index: 0,
    notes: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

/** Mutable per-test server state (reset in beforeEach). */
let beats: BeatRead[];

describe("SceneBeatsPanel", () => {
  beforeEach(() => {
    // Seed so ARRAY order ≠ order_index order: the panel must sort by
    // order_index (a bug that renders the raw array order fails the order
    // assertions below).
    beats = [
      makeBeat({ id: "beat-b", description: "Második beat", order_index: 1 }),
      makeBeat({
        id: "beat-a",
        description: "Első beat",
        order_index: 0,
        beat_type: "fordulat",
      }),
      makeBeat({ id: "beat-c", description: "Harmadik beat", order_index: 2 }),
    ];
    server.use(
      http.get(`${API}/scenes/:sceneId/beats`, ({ params }) => {
        expect(params.sceneId).toBe(SCENE_ID);
        return HttpResponse.json(beats);
      }),
    );
  });

  it("lists the beats in order_index order, not response order", async () => {
    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(3);
    // order_index order (a, b, c) even though the response is (b, a, c).
    expect(items[0]).toHaveTextContent("Első beat");
    expect(items[1]).toHaveTextContent("Második beat");
    expect(items[2]).toHaveTextContent("Harmadik beat");

    // The beat_type badge renders only for the typed beat.
    expect(screen.getByText("fordulat")).toBeInTheDocument();
  });

  it("composer POSTs the scene-scoped payload and the new beat appears", async () => {
    const posted: { sceneId: string; body: unknown }[] = [];
    server.use(
      http.post(`${API}/scenes/:sceneId/beats`, async ({ params, request }) => {
        const body = (await request.json()) as {
          description: string;
          order_index: number;
        };
        posted.push({ sceneId: String(params.sceneId), body });
        const created = makeBeat({
          id: "beat-new",
          description: body.description,
          order_index: body.order_index,
        });
        beats = [...beats, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);
    await screen.findAllByRole("listitem");

    const composer = screen.getByLabelText(hu.beats.composerLabel);
    await user.type(composer, "Negyedik beat");
    await user.click(screen.getByRole("button", { name: hu.beats.addButton }));

    await waitFor(() => expect(posted).toHaveLength(1));
    // Scene-scoped URL + EXACT body: appended at the end (order_index 3).
    expect(posted[0].sceneId).toBe(SCENE_ID);
    expect(posted[0].body).toEqual({
      description: "Negyedik beat",
      order_index: 3,
    });

    // Invalidation: the refetched list now shows the new beat; composer clears.
    expect(await screen.findByText("Negyedik beat")).toBeInTheDocument();
    expect(screen.getByLabelText(hu.beats.composerLabel)).toHaveValue("");
  });

  it("edit PATCHes the RIGHT beat id with the new description", async () => {
    const patched: { sceneId: string; beatId: string; body: unknown }[] = [];
    server.use(
      http.patch(
        `${API}/scenes/:sceneId/beats/:beatId`,
        async ({ params, request }) => {
          const body = (await request.json()) as Partial<BeatRead>;
          patched.push({
            sceneId: String(params.sceneId),
            beatId: String(params.beatId),
            body,
          });
          beats = beats.map((b) =>
            b.id === params.beatId ? { ...b, ...body } : b,
          );
          const updated = beats.find((b) => b.id === params.beatId);
          return HttpResponse.json(updated);
        },
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);
    await screen.findAllByRole("listitem");

    // Edit the SECOND row (display position 2 → "Második beat" → beat-b).
    await user.click(screen.getByRole("button", { name: hu.beats.editAria(2) }));
    const field = screen.getByLabelText(hu.beats.editLabel);
    expect(field).toHaveValue("Második beat");
    await user.clear(field);
    await user.type(field, "Módosított beat");
    await user.click(screen.getByRole("button", { name: hu.beats.save }));

    await waitFor(() => expect(patched).toHaveLength(1));
    // The RIGHT beat (not the first row's id), the RIGHT scene, EXACT body.
    expect(patched[0].beatId).toBe("beat-b");
    expect(patched[0].sceneId).toBe(SCENE_ID);
    expect(patched[0].body).toEqual({ description: "Módosított beat" });

    // Invalidation: the refetched list renders the new text; editor closed.
    expect(await screen.findByText("Módosított beat")).toBeInTheDocument();
    expect(screen.queryByLabelText(hu.beats.editLabel)).not.toBeInTheDocument();
  });

  it("cancel closes the editor without a PATCH", async () => {
    const patched: unknown[] = [];
    server.use(
      http.patch(`${API}/scenes/:sceneId/beats/:beatId`, async () => {
        patched.push(true);
        return HttpResponse.json(beats[0]);
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);
    await screen.findAllByRole("listitem");

    await user.click(screen.getByRole("button", { name: hu.beats.editAria(1) }));
    await user.click(screen.getByRole("button", { name: hu.beats.cancel }));

    expect(screen.queryByLabelText(hu.beats.editLabel)).not.toBeInTheDocument();
    expect(patched).toHaveLength(0);
    // The original text is untouched.
    expect(screen.getByText("Első beat")).toBeInTheDocument();
  });

  it("delete DELETEs the RIGHT beat id, removes the row and toasts", async () => {
    const deleted: { sceneId: string; beatId: string }[] = [];
    server.use(
      http.delete(`${API}/scenes/:sceneId/beats/:beatId`, ({ params }) => {
        deleted.push({
          sceneId: String(params.sceneId),
          beatId: String(params.beatId),
        });
        beats = beats.filter((b) => b.id !== params.beatId);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);
    await screen.findAllByRole("listitem");

    // Delete the FIRST row (display position 1 → "Első beat" → beat-a).
    await user.click(
      screen.getByRole("button", { name: hu.beats.deleteAria(1) }),
    );

    await waitFor(() => expect(deleted).toHaveLength(1));
    expect(deleted[0].beatId).toBe("beat-a");
    expect(deleted[0].sceneId).toBe(SCENE_ID);

    // Invalidation: the row is gone from the refetched list; toast shown.
    // (Scope the row count to the beats list — the sonner toast itself renders
    // as a listitem in its own list.)
    await waitFor(() =>
      expect(screen.queryByText("Első beat")).not.toBeInTheDocument(),
    );
    const list = screen.getByRole("list", { name: hu.beats.listAria });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(await screen.findByText(hu.beats.toastDeleted)).toBeInTheDocument();
  });

  it("shows the empty state (with composer) when the scene has no beats", async () => {
    server.use(
      http.get(`${API}/scenes/:sceneId/beats`, () => HttpResponse.json([])),
    );

    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);

    expect(await screen.findByText(hu.beats.empty)).toBeInTheDocument();
    // The composer is still available so the first beat can be added.
    expect(screen.getByLabelText(hu.beats.composerLabel)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("surfaces a load error (no silent swallow)", async () => {
    server.use(
      http.get(`${API}/scenes/:sceneId/beats`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      hu.beats.loadError,
    );
  });

  it("prompts to open a scene when no scene is active", () => {
    renderWithProviders(<SceneBeatsPanel sceneId={undefined} />);
    expect(screen.getByText(hu.beats.noScene)).toBeInTheDocument();
  });

  it("is a11y clean; rows expose keyboard-reachable, labelled affordances", async () => {
    const { container } = renderWithProviders(
      <SceneBeatsPanel sceneId={SCENE_ID} />,
    );
    await screen.findAllByRole("listitem");

    // Every row affordance is a real button with an accessible name — drag
    // handle, edit and delete are all keyboard-reachable.
    for (const position of [1, 2, 3]) {
      expect(
        screen.getByRole("button", { name: hu.beats.dragHandleAria(position) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: hu.beats.editAria(position) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: hu.beats.deleteAria(position) }),
      ).toBeInTheDocument();
    }
    // The composer field is labelled.
    expect(screen.getByLabelText(hu.beats.composerLabel)).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });
});
