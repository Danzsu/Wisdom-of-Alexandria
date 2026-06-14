import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers, createTestQueryClient } from "@/test/test-utils";
import { useAutosave, AUTOSAVE_DELAY_MS } from "../use-autosave";
import { useEditorStore } from "@/lib/stores/editor-store";
import {
  CHAPTER_ONE,
  CHAPTER_TWO,
  SCENE_ACTIVE,
  SCENE_FIRST,
} from "@/test/msw/fixtures";

const base = `${API_BASE_URL}/api/v1`;

function wrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

/**
 * Drain the debounce window + the resulting async mutation under fake timers
 * (testing-library's `waitFor` deadlocks against `vi.useFakeTimers`, so we drive
 * the resolution manually with `advanceTimersByTimeAsync`). Advances well past
 * the debounce and flushes microtasks so the request settles.
 */
async function settleSave(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50);
  });
  // A couple of extra microtask flushes for the mutation promise chain.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
  }
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStore.setState({ saveState: "saved" });
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("debounces: a single save fires after the delay", async () => {
    let patchCount = 0;
    server.use(
      http.patch(`${base}/chapters/:chapterId/scenes/:sceneId`, async () => {
        patchCount += 1;
        return HttpResponse.json({ ...SCENE_ACTIVE, content: "x", word_count: 1 });
      }),
    );

    const { result } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );

    act(() => {
      result.current.scheduleSave("a");
      result.current.scheduleSave("ab");
      result.current.scheduleSave("abc");
    });

    // Nothing before the debounce window elapses.
    expect(patchCount).toBe(0);
    expect(useEditorStore.getState().saveState).toBe("saved");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    await settleSave();

    // The 3 rapid edits debounce into a single PATCH.
    expect(patchCount).toBe(1);
    expect(useEditorStore.getState().saveState).toBe("saved");
  });

  it("transitions through saving → saved", async () => {
    server.use(
      http.patch(`${base}/chapters/:chapterId/scenes/:sceneId`, async () =>
        HttpResponse.json({ ...SCENE_ACTIVE, content: "y", word_count: 1 }),
      ),
    );
    const { result } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );

    act(() => result.current.scheduleSave("hello"));
    await settleSave();
    expect(useEditorStore.getState().saveState).toBe("saved");
  });

  it("sets the error state when the save fails (not swallowed)", async () => {
    server.use(
      http.patch(`${base}/chapters/:chapterId/scenes/:sceneId`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );

    act(() => result.current.scheduleSave("hello"));
    await settleSave();
    expect(useEditorStore.getState().saveState).toBe("error");
  });

  it("flush() saves the pending content immediately", async () => {
    let patchCount = 0;
    server.use(
      http.patch(`${base}/chapters/:chapterId/scenes/:sceneId`, async () => {
        patchCount += 1;
        return HttpResponse.json({ ...SCENE_ACTIVE, content: "z", word_count: 1 });
      }),
    );
    const { result } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );

    act(() => result.current.scheduleSave("flush me"));
    act(() => result.current.flush());
    await settleSave();
    expect(patchCount).toBe(1);
  });

  // ---- Regression: wrong-scene save on scene switch mid-debounce ----
  // Schedule a save under scene A's ids, switch the hook to scene B BEFORE the
  // debounce fires, and assert the queued save still PATCHes scene A with A's
  // content — never scene B. This FAILS against the old hook, which read a
  // mutable `idsRef` (synchronously updated to B) inside `runSave`.
  it("saves the scene it was scheduled for, even after a mid-debounce switch", async () => {
    const patched: Array<{
      chapterId: string;
      sceneId: string;
      content: unknown;
    }> = [];
    server.use(
      http.patch(
        `${base}/chapters/:chapterId/scenes/:sceneId`,
        async ({ params, request }) => {
          const body = (await request.json()) as { content?: unknown };
          patched.push({
            chapterId: params.chapterId as string,
            sceneId: params.sceneId as string,
            content: body.content,
          });
          return HttpResponse.json({ ...SCENE_ACTIVE, content: "ok", word_count: 1 });
        },
      ),
    );

    const { result, rerender } = renderHook(
      ({ chapterId, sceneId }) => useAutosave({ chapterId, sceneId }),
      {
        wrapper: wrapper(),
        initialProps: {
          chapterId: CHAPTER_ONE.id,
          sceneId: SCENE_FIRST.id,
        },
      },
    );

    // Edit scene A; timer is armed, pending = A's text against A's ids.
    act(() => result.current.scheduleSave("A content"));

    // Switch to scene B before the debounce fires (route param change → the
    // un-keyed page re-renders the hook with B's ids; the timer survives).
    rerender({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id });

    await settleSave();

    // A's pending edit must have persisted (flushed on switch), targeting A.
    expect(patched.length).toBeGreaterThanOrEqual(1);
    const aSave = patched.find((p) => p.sceneId === SCENE_FIRST.id);
    expect(aSave).toBeDefined();
    expect(aSave?.chapterId).toBe(CHAPTER_ONE.id);
    expect(aSave?.content).toBe("A content");
    // Critically: scene B must NEVER receive scene A's content.
    const bWithAContent = patched.find(
      (p) => p.sceneId === SCENE_ACTIVE.id && p.content === "A content",
    );
    expect(bWithAContent).toBeUndefined();
  });

  it("flushes scene A's pending edit when the active scene changes", async () => {
    let patchCount = 0;
    let lastSceneId: string | null = null;
    server.use(
      http.patch(
        `${base}/chapters/:chapterId/scenes/:sceneId`,
        async ({ params }) => {
          patchCount += 1;
          lastSceneId = params.sceneId as string;
          return HttpResponse.json({ ...SCENE_FIRST, content: "ok", word_count: 1 });
        },
      ),
    );

    const { result, rerender } = renderHook(
      ({ chapterId, sceneId }) => useAutosave({ chapterId, sceneId }),
      {
        wrapper: wrapper(),
        initialProps: {
          chapterId: CHAPTER_ONE.id,
          sceneId: SCENE_FIRST.id,
        },
      },
    );

    act(() => result.current.scheduleSave("unsaved edit"));
    // No save yet — still within the debounce window.
    expect(patchCount).toBe(0);

    // Switching scenes must flush the pending edit (against scene A's ids).
    rerender({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id });
    await settleSave();

    expect(patchCount).toBe(1);
    expect(lastSceneId).toBe(SCENE_FIRST.id);
  });

  it("does not save without chapter/scene ids", async () => {
    let patchCount = 0;
    server.use(
      http.patch(`${base}/chapters/:chapterId/scenes/:sceneId`, async () => {
        patchCount += 1;
        return HttpResponse.json(SCENE_ACTIVE);
      }),
    );
    const { result } = renderHook(
      () => useAutosave({ chapterId: undefined, sceneId: undefined }),
      { wrapper: wrapper() },
    );
    act(() => result.current.scheduleSave("x"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    expect(patchCount).toBe(0);
  });
});
