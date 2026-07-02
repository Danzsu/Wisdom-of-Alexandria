"use client";

import { useCallback, useEffect, useRef } from "react";
import { useUpdateScene } from "@/lib/api/hooks";
import { useEditorStore } from "@/lib/stores/editor-store";

/** Debounce delay for autosave (ms). */
export const AUTOSAVE_DELAY_MS = 800;

/**
 * Backoff ladder for automatic retries after a failed save (ms): a failed
 * PATCH re-fires after ~2s, then ~5s, then ~10s. When the ladder is exhausted
 * the save-state machine lands on `error` and the StatusBar offers a manual
 * "Újra" retry (registered on the editor store as `retrySave`).
 */
export const AUTOSAVE_RETRY_BACKOFF_MS = [2_000, 5_000, 10_000] as const;

export interface UseAutosaveArgs {
  chapterId: string | undefined;
  sceneId: string | undefined;
}

export interface UseAutosaveResult {
  /** Queue a debounced save of the given content. */
  scheduleSave: (content: string) => void;
  /** Flush any pending or failed save immediately (e.g. on unmount). */
  flush: () => void;
}

/** A queued save: the content plus the scene it was scheduled for. */
interface PendingSave {
  content: string;
  chapterId: string | undefined;
  sceneId: string | undefined;
}

/**
 * Debounced scene autosave, resilient to transient network failure.
 *
 * On `scheduleSave(content)` it (re)arms an {@link AUTOSAVE_DELAY_MS} timer; when
 * it fires it PATCHes the scene content via `useUpdateScene` and drives the
 * editor-store save-state machine: `saving` → `saved` on success. The backend
 * recomputes `word_count`, so only `content` is sent.
 *
 * FAILURE HANDLING (the "local-first" honesty slice):
 * - A failed PATCH is retried automatically on the {@link AUTOSAVE_RETRY_BACKOFF_MS}
 *   ladder (save-state `retrying`). The failed payload is kept in `failedRef`;
 *   any NEWER keystroke supersedes it (clears `failedRef`, cancels the backoff
 *   timer, resets the attempt count) so a retry always carries the latest
 *   content — a stale failed payload is never re-sent over newer edits. A
 *   failure whose response lands AFTER a newer edit was scheduled is likewise
 *   dropped (the newer debounce owns the next request).
 * - When the ladder is exhausted the state lands on `error`; the hook registers
 *   `retrySave` on the editor store so the StatusBar's "Újra" button (shell
 *   subtree, across the route boundary) can re-fire it manually.
 * - While anything is unsaved (debounce pending, save in flight, retrying or
 *   failed) a `beforeunload` guard asks the browser-native confirm before the
 *   tab closes. No network save is attempted there — `beforeunload` cannot
 *   await a fetch. A full offline queue (IndexedDB-persisted edits surviving a
 *   tab close while offline) is the future extension of this slice.
 *
 * IMPORTANT (wrong-scene-save guard): the page mounts this hook un-keyed, so its
 * debounce timer survives a scene switch (a route-param change does not unmount
 * the page). The target `{chapterId, sceneId}` is therefore captured into the
 * pending save at `scheduleSave` time — saves and retries always PATCH the
 * scene the edit was scheduled for, never whatever scene happens to be active
 * when a timer fires. On a scene switch the hook flushes a pending edit AND
 * fires an immediate final attempt for a failed one (still against the old
 * scene's captured ids), so a failed edit is never silently dropped.
 */
export function useAutosave({
  chapterId,
  sceneId,
}: UseAutosaveArgs): UseAutosaveResult {
  const mutation = useUpdateScene();
  const setSaveState = useEditorStore((s) => s.setSaveState);
  const setRetrySave = useEditorStore((s) => s.setRetrySave);

  /** Debounce timer for the next scheduled save. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Backoff timer for the next automatic retry of a failed save. */
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Payload armed behind the debounce timer (consumed by `runSave`). */
  const pendingRef = useRef<PendingSave | null>(null);
  /** Payload of the last FAILED save — kept until superseded or persisted. */
  const failedRef = useRef<PendingSave | null>(null);
  /** Failed attempts in the current save cycle (resets on edit / success). */
  const attemptRef = useRef(0);
  /** Unsaved-changes flag driving the `beforeunload` guard. */
  const dirtyRef = useRef(false);
  // Keep the mutation in a ref so the stable callbacks don't re-create on every
  // mutation state change (which would re-arm timers unexpectedly).
  const mutateRef = useRef(mutation.mutateAsync);
  mutateRef.current = mutation.mutateAsync;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const runSave = useCallback(async () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending == null) return;
    // Use the ids captured when the save was scheduled — NOT the currently
    // active scene — so a switch mid-debounce never PATCHes the new scene with
    // the old scene's content.
    const { content, chapterId: cid, sceneId: sid } = pending;
    if (!cid || !sid) return;
    setSaveState(attemptRef.current > 0 ? "retrying" : "saving");
    try {
      await mutateRef.current({
        chapterId: cid,
        sceneId: sid,
        patch: { content },
      });
      attemptRef.current = 0;
      setSaveState("saved");
      // Only clean when no newer edit arrived while this request was in
      // flight — that edit is still unsaved (its debounce is armed).
      if (pendingRef.current == null) dirtyRef.current = false;
    } catch (error) {
      // Surface the failure in the StatusBar rather than swallowing it; the
      // thrown ApiError is also available on the mutation's `error` for callers.
      // Also log it so a real failure (401/network) is visible in the dev
      // console, not only as a StatusBar state (no token/secret is logged).
      console.error("Autosave failed", { sceneId: sid, error });
      if (pendingRef.current != null) {
        // Superseded while in flight: a newer edit is already debounce-armed
        // and will PATCH the newest content — never retry this stale payload.
        return;
      }
      failedRef.current = pending;
      if (attemptRef.current < AUTOSAVE_RETRY_BACKOFF_MS.length) {
        const delay = AUTOSAVE_RETRY_BACKOFF_MS[attemptRef.current];
        attemptRef.current += 1;
        setSaveState("retrying");
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          // Re-arm the failed payload — still the latest content, because a
          // newer keystroke would have cleared it and cancelled this timer.
          const payload = failedRef.current;
          if (payload == null) return;
          failedRef.current = null;
          pendingRef.current = payload;
          void runSave();
        }, delay);
      } else {
        // Ladder exhausted — give up automatically; the StatusBar now shows
        // "Mentés sikertelen — Újra" wired to `retryNow` below.
        setSaveState("error");
      }
    }
  }, [setSaveState]);

  const scheduleSave = useCallback(
    (content: string) => {
      dirtyRef.current = true;
      // A newer keystroke supersedes any failed payload and resets the retry
      // cycle: the fresh debounce below carries the newest content, so the
      // stale failed payload must never re-fire.
      failedRef.current = null;
      clearRetryTimer();
      attemptRef.current = 0;
      // Capture the target scene at schedule time (closure over the current
      // ids), so the queued save always targets the scene it was armed for.
      pendingRef.current = { content, chapterId, sceneId };
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSave();
      }, AUTOSAVE_DELAY_MS);
    },
    [runSave, clearRetryTimer, chapterId, sceneId],
  );

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current != null) {
      void runSave();
      return;
    }
    // A failed payload waiting on a backoff timer (or stranded in `error`)
    // must not be silently dropped on scene switch / unmount — fire the final
    // attempt now, still against the ids captured at schedule time.
    if (failedRef.current != null) {
      clearRetryTimer();
      pendingRef.current = failedRef.current;
      failedRef.current = null;
      void runSave();
    }
  }, [runSave, clearRetryTimer]);

  /** Manual retry (StatusBar "Újra"): collapse any armed backoff and re-fire
   *  the failed payload immediately with a fresh auto-retry cycle. */
  const retryNow = useCallback(() => {
    clearRetryTimer();
    const payload = failedRef.current;
    if (payload == null) return;
    failedRef.current = null;
    attemptRef.current = 0;
    pendingRef.current = payload;
    void runSave();
  }, [runSave, clearRetryTimer]);

  // Register the manual-retry bridge so the StatusBar (rendered by the shell,
  // across the route boundary) can re-fire a failed save — the same store
  // bridge pattern as `applySuggestion`.
  useEffect(() => {
    setRetrySave(retryNow);
    return () => setRetrySave(null);
  }, [setRetrySave, retryNow]);

  // Unsaved-changes protection: while dirty, closing/reloading the tab asks
  // the browser-native confirm. `beforeunload` cannot await a fetch, so no
  // save is attempted here — persisting the edit across a forced close is the
  // future offline/IndexedDB-queue extension noted above.
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      // Chromium still requires `returnValue` for the native dialog.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  // Flush when the active scene changes (and on unmount): scene A's last
  // keystroke must persist (against A's ids, which the pending/failed save
  // already captured) before B takes over — including one immediate final
  // attempt for a save that failed and was still waiting on its backoff.
  useEffect(() => {
    return () => {
      flush();
    };
  }, [sceneId, flush]);

  return { scheduleSave, flush };
}
