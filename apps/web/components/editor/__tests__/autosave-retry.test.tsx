import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers, createTestQueryClient } from "@/test/test-utils";
import {
  useAutosave,
  AUTOSAVE_DELAY_MS,
  AUTOSAVE_RETRY_BACKOFF_MS,
} from "../use-autosave";
import { useEditorStore } from "@/lib/stores/editor-store";
import {
  CHAPTER_ONE,
  CHAPTER_TWO,
  SCENE_ACTIVE,
  SCENE_FIRST,
} from "@/test/msw/fixtures";

const base = `${API_BASE_URL}/api/v1`;
const sceneUrl = `${base}/chapters/:chapterId/scenes/:sceneId`;

function wrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

/**
 * Advance the fake clock by `ms`, then flush a few extra micro-steps so any
 * in-flight MSW response settles through the mutation promise chain. NOTE:
 * adds ~50ms of extra clock time — timing assertions below leave generous
 * margins around the backoff boundaries to stay robust against this slop.
 */
async function drain(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
  }
}

/** A PATCH handler whose failure mode is a mutable flag; records payloads. */
function installPatchHandler(state: { fail: boolean }) {
  const bodies: Array<{
    chapterId: string;
    sceneId: string;
    content: unknown;
  }> = [];
  server.use(
    http.patch(sceneUrl, async ({ params, request }) => {
      const body = (await request.json()) as { content?: unknown };
      bodies.push({
        chapterId: params.chapterId as string,
        sceneId: params.sceneId as string,
        content: body.content,
      });
      if (state.fail) {
        return HttpResponse.json({ detail: "offline" }, { status: 503 });
      }
      return HttpResponse.json({
        ...SCENE_ACTIVE,
        content: "ok",
        word_count: 1,
      });
    }),
  );
  return bodies;
}

describe("useAutosave retry + unsaved-changes protection", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStore.setState({ saveState: "saved", retrySave: null });
    // Failed attempts log console.error by design; keep the test output clean.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    errorSpy.mockRestore();
  });

  it("auto-retries a failed save after the first backoff and reaches saved", async () => {
    const state = { fail: true };
    const bodies = installPatchHandler(state);

    const { result } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );

    act(() => result.current.scheduleSave("makacs bekezdés"));
    await drain(AUTOSAVE_DELAY_MS);

    // First attempt failed → retrying (not error, not saved).
    expect(bodies).toHaveLength(1);
    expect(useEditorStore.getState().saveState).toBe("retrying");

    // The retry must respect the first backoff step: well before ~2s after the
    // failure there must be no second request.
    await drain(AUTOSAVE_RETRY_BACKOFF_MS[0] - 1000);
    expect(bodies).toHaveLength(1);

    // Now let the retry fire — and let it succeed.
    state.fail = false;
    await drain(1200);
    expect(bodies).toHaveLength(2);
    // The retried request carries the latest scheduled content (same scene).
    expect(bodies[1]).toEqual({
      chapterId: CHAPTER_TWO.id,
      sceneId: SCENE_ACTIVE.id,
      content: "makacs bekezdés",
    });
    expect(useEditorStore.getState().saveState).toBe("saved");
  });

  it("exhausts the backoff ladder → error; the store-registered manual retry re-PATCHes and clears to saved", async () => {
    const state = { fail: true };
    const bodies = installPatchHandler(state);

    const { result } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );

    // The hook registers the manual-retry bridge for the StatusBar button.
    expect(useEditorStore.getState().retrySave).toBeTypeOf("function");

    act(() => result.current.scheduleSave("v-final"));
    await drain(AUTOSAVE_DELAY_MS); // attempt 1 fails
    expect(bodies).toHaveLength(1);
    expect(useEditorStore.getState().saveState).toBe("retrying");

    await drain(AUTOSAVE_RETRY_BACKOFF_MS[0] + 100); // retry 1 fails
    expect(bodies).toHaveLength(2);
    expect(useEditorStore.getState().saveState).toBe("retrying");

    await drain(AUTOSAVE_RETRY_BACKOFF_MS[1] + 100); // retry 2 fails
    expect(bodies).toHaveLength(3);
    expect(useEditorStore.getState().saveState).toBe("retrying");

    await drain(AUTOSAVE_RETRY_BACKOFF_MS[2] + 100); // retry 3 fails → give up
    expect(bodies).toHaveLength(4);
    expect(useEditorStore.getState().saveState).toBe("error");

    // No infinite retrying after exhaustion.
    await drain(20_000);
    expect(bodies).toHaveLength(4);
    expect(useEditorStore.getState().saveState).toBe("error");

    // Manual retry (what the StatusBar "Újra" button calls) → success → saved.
    state.fail = false;
    act(() => {
      useEditorStore.getState().retrySave?.();
    });
    await drain(100);
    expect(bodies).toHaveLength(5);
    expect(bodies[4].content).toBe("v-final");
    expect(useEditorStore.getState().saveState).toBe("saved");
  });

  it("newer keystrokes during the retry window supersede the failed payload — the next request carries the NEWEST text, the stale retry never fires", async () => {
    const bodies: Array<unknown> = [];
    server.use(
      http.patch(sceneUrl, async ({ request }) => {
        const body = (await request.json()) as { content?: unknown };
        bodies.push(body.content);
        // Only the stale first version fails; anything newer saves fine.
        if (body.content === "v1") {
          return HttpResponse.json({ detail: "offline" }, { status: 503 });
        }
        return HttpResponse.json({
          ...SCENE_ACTIVE,
          content: "ok",
          word_count: 2,
        });
      }),
    );

    const { result } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );

    act(() => result.current.scheduleSave("v1"));
    await drain(AUTOSAVE_DELAY_MS);
    expect(bodies).toEqual(["v1"]);
    expect(useEditorStore.getState().saveState).toBe("retrying");

    // Keystrokes arrive while the backoff timer is pending.
    act(() => result.current.scheduleSave("v1 v2"));
    await drain(AUTOSAVE_DELAY_MS + 100);

    // The debounced save carried the NEWEST text and succeeded.
    expect(bodies).toEqual(["v1", "v1 v2"]);
    expect(useEditorStore.getState().saveState).toBe("saved");

    // Mutation check: the stale "v1" retry must never fire — even long after
    // every backoff step has elapsed there are exactly 2 requests, and the
    // state stays saved (no late flip back to retrying/error).
    await drain(AUTOSAVE_RETRY_BACKOFF_MS[2] + 5_000);
    expect(bodies).toEqual(["v1", "v1 v2"]);
    expect(useEditorStore.getState().saveState).toBe("saved");
  });

  it("scene switch with a failed save fires an immediate final attempt against the OLD scene ids (content never silently dropped)", async () => {
    const state = { fail: true };
    const bodies = installPatchHandler(state);

    const { rerender, result } = renderHook(
      ({ chapterId, sceneId }) => useAutosave({ chapterId, sceneId }),
      {
        wrapper: wrapper(),
        initialProps: { chapterId: CHAPTER_ONE.id, sceneId: SCENE_FIRST.id },
      },
    );

    act(() => result.current.scheduleSave("A jelenet utolsó mondata"));
    await drain(AUTOSAVE_DELAY_MS);
    expect(bodies).toHaveLength(1);
    expect(useEditorStore.getState().saveState).toBe("retrying");

    // Switch to scene B while the failed payload waits on the ~2s backoff.
    state.fail = false;
    rerender({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id });

    // The final attempt fires immediately (well before the backoff elapses)
    // and targets the scene the edit was captured for — scene A.
    await drain(150);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual({
      chapterId: CHAPTER_ONE.id,
      sceneId: SCENE_FIRST.id,
      content: "A jelenet utolsó mondata",
    });
    expect(useEditorStore.getState().saveState).toBe("saved");

    // The cancelled backoff timer must not double-fire later.
    await drain(AUTOSAVE_RETRY_BACKOFF_MS[0] + 2_000);
    expect(bodies).toHaveLength(2);
  });

  it("beforeunload guard: blocks while dirty (pending / retrying), inert once saved, unregistered on unmount", async () => {
    const state = { fail: false };
    installPatchHandler(state);
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { result, unmount } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );

    const dispatchBeforeUnload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    // Clean editor → no guard.
    expect(dispatchBeforeUnload()).toBe(false);

    // Dirty (debounce pending) → the browser-native confirm is requested.
    act(() => result.current.scheduleSave("piszkozat"));
    expect(dispatchBeforeUnload()).toBe(true);

    // Saved → guard is inert again.
    await drain(AUTOSAVE_DELAY_MS);
    expect(useEditorStore.getState().saveState).toBe("saved");
    expect(dispatchBeforeUnload()).toBe(false);

    // Dirty via a FAILED save (retry pending) → still guarded.
    state.fail = true;
    act(() => result.current.scheduleSave("piszkozat 2"));
    await drain(AUTOSAVE_DELAY_MS);
    expect(useEditorStore.getState().saveState).toBe("retrying");
    expect(dispatchBeforeUnload()).toBe(true);

    // The auto-retry recovers → guard inert.
    state.fail = false;
    await drain(AUTOSAVE_RETRY_BACKOFF_MS[0] + 500);
    expect(useEditorStore.getState().saveState).toBe("saved");
    expect(dispatchBeforeUnload()).toBe(false);

    // Unmount removes the exact registered listener.
    const registration = addSpy.mock.calls.find(
      (call) => call[0] === "beforeunload",
    );
    expect(registration).toBeDefined();
    unmount();
    const removal = removeSpy.mock.calls.find(
      (call) => call[0] === "beforeunload" && call[1] === registration?.[1],
    );
    expect(removal).toBeDefined();

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("unmount clears the manual-retry bridge from the store", async () => {
    const state = { fail: false };
    installPatchHandler(state);
    const { unmount } = renderHook(
      () => useAutosave({ chapterId: CHAPTER_TWO.id, sceneId: SCENE_ACTIVE.id }),
      { wrapper: wrapper() },
    );
    expect(useEditorStore.getState().retrySave).toBeTypeOf("function");
    unmount();
    expect(useEditorStore.getState().retrySave).toBeNull();
  });
});
