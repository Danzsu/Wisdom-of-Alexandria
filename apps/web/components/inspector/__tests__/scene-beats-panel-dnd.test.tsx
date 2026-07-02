/**
 * SceneBeatsPanel reorder wiring. Real pointer drags are flaky in jsdom, so —
 * following the plan-grid-dnd pattern — `@dnd-kit/core` is mocked to CAPTURE
 * the `onDragEnd` handler the panel passes to `DndContext`; the tests invoke it
 * with synthetic drag-end events and assert (via MSW capture) that the panel
 * POSTs the EXACT new full id order to the scene's `/beats/reorder` endpoint —
 * and that no-op drops send NOTHING.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/test-utils";
import { API_BASE_URL } from "@/lib/api/client";
import type { DragEndEvent } from "@dnd-kit/core";
import type { BeatRead } from "@/lib/api/types";

// Capture the onDragEnd handler the panel wires into DndContext, and stub the
// sortable/context primitives so the component renders without a dnd runtime.
let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd: (event: DragEndEvent) => void;
  }) => {
    capturedOnDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
  KeyboardSensor: class {},
  PointerSensor: class {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return {
    ...actual,
    SortableContext: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      setActivatorNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  };
});

import { SceneBeatsPanel } from "../scene-beats-panel";

const API = `${API_BASE_URL}/api/v1`;
const SCENE_ID = "scene-beats-dnd";

function makeBeat(id: string, description: string, orderIndex: number): BeatRead {
  return {
    id,
    scene_id: SCENE_ID,
    description,
    beat_type: null,
    order_index: orderIndex,
    notes: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
}

let beats: BeatRead[];

function dragEnd(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId },
    over: overId ? { id: overId } : null,
  } as unknown as DragEndEvent;
}

describe("SceneBeatsPanel — reorder", () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
    // Response array order ≠ order_index order — display is a, b, c.
    beats = [
      makeBeat("beat-b", "Második beat", 1),
      makeBeat("beat-a", "Első beat", 0),
      makeBeat("beat-c", "Harmadik beat", 2),
    ];
    server.use(
      http.get(`${API}/scenes/:sceneId/beats`, () => HttpResponse.json(beats)),
    );
  });

  it("dragging the first beat onto the last POSTs the EXACT new id order", async () => {
    const posted: { sceneId: string; body: unknown }[] = [];
    server.use(
      http.post(
        `${API}/scenes/:sceneId/beats/reorder`,
        async ({ params, request }) => {
          const body = (await request.json()) as { order: string[] };
          posted.push({ sceneId: String(params.sceneId), body });
          // Persist like the backend: reindex order_index by position.
          const byId = new Map(beats.map((b) => [b.id, b]));
          beats = body.order.flatMap((id, i) => {
            const beat = byId.get(id);
            return beat ? [{ ...beat, order_index: i }] : [];
          });
          return HttpResponse.json(beats);
        },
      ),
    );

    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);
    await screen.findAllByRole("listitem");
    expect(capturedOnDragEnd).not.toBeNull();

    // Display order is [a, b, c]; drag a onto c → [b, c, a].
    await act(async () => {
      capturedOnDragEnd?.(dragEnd("beat-a", "beat-c"));
    });

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].sceneId).toBe(SCENE_ID);
    // The FULL id sequence, in the exact new order — nothing dropped, nothing
    // duplicated, no stale positions.
    expect(posted[0].body).toEqual({
      order: ["beat-b", "beat-c", "beat-a"],
    });

    // The persisted order is what renders after the settle/refetch.
    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("Második beat");
      expect(items[1]).toHaveTextContent("Harmadik beat");
      expect(items[2]).toHaveTextContent("Első beat");
    });
  });

  it("a drop with no target, onto itself, or on an unknown id sends NOTHING", async () => {
    const posted: unknown[] = [];
    server.use(
      http.post(`${API}/scenes/:sceneId/beats/reorder`, async () => {
        posted.push(true);
        return HttpResponse.json(beats);
      }),
    );

    renderWithProviders(<SceneBeatsPanel sceneId={SCENE_ID} />);
    await screen.findAllByRole("listitem");

    await act(async () => {
      capturedOnDragEnd?.(dragEnd("beat-a", null)); // dropped outside
      capturedOnDragEnd?.(dragEnd("beat-a", "beat-a")); // dropped on itself
      capturedOnDragEnd?.(dragEnd("ghost", "beat-a")); // unknown active id
    });

    // Give a would-be request a tick to fire, then assert none did.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(posted).toHaveLength(0);

    // The list is untouched.
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Első beat");
    expect(items[1]).toHaveTextContent("Második beat");
    expect(items[2]).toHaveTextContent("Harmadik beat");
  });
});
