"use client";

import { useCallback, useEffect, useRef } from "react";
import { useUpdateScene } from "@/lib/api/hooks";
import { useEditorStore } from "@/lib/stores/editor-store";

/** Debounce delay for autosave (ms). */
export const AUTOSAVE_DELAY_MS = 800;

export interface UseAutosaveArgs {
  chapterId: string | undefined;
  sceneId: string | undefined;
}

export interface UseAutosaveResult {
  /** Queue a debounced save of the given content. */
  scheduleSave: (content: string) => void;
  /** Flush any pending save immediately (e.g. on unmount). */
  flush: () => void;
}

/** A queued save: the content plus the scene it was scheduled for. */
interface PendingSave {
  content: string;
  chapterId: string | undefined;
  sceneId: string | undefined;
}

/**
 * Debounced scene autosave.
 *
 * On `scheduleSave(content)` it (re)arms an {@link AUTOSAVE_DELAY_MS} timer; when
 * it fires it PATCHes the scene content via `useUpdateScene` and drives the
 * editor-store save-state machine: `saving` → `saved` on success, `error` on
 * failure. The backend recomputes `word_count`, so only `content` is sent. The
 * timer is always cleared on unmount; the latest content is flushed first so an
 * in-flight edit is never lost. Errors are surfaced (save-state `error`) and the
 * mutation promise is awaited — never floated.
 *
 * IMPORTANT (wrong-scene-save guard): the page mounts this hook un-keyed, so its
 * debounce timer survives a scene switch (a route-param change does not unmount
 * the page). The target `{chapterId, sceneId}` is therefore captured into the
 * pending save at `scheduleSave` time — `runSave` PATCHes the scene the edit was
 * scheduled for, never whatever scene happens to be active when the timer fires.
 * The hook also flushes a pending edit when `sceneId` changes, so scene A's last
 * keystroke is persisted (against A) before B takes over.
 */
export function useAutosave({
  chapterId,
  sceneId,
}: UseAutosaveArgs): UseAutosaveResult {
  const mutation = useUpdateScene();
  const setSaveState = useEditorStore((s) => s.setSaveState);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingSave | null>(null);
  // Keep the mutation in a ref so the stable callbacks don't re-create on every
  // mutation state change (which would re-arm timers unexpectedly).
  const mutateRef = useRef(mutation.mutateAsync);
  mutateRef.current = mutation.mutateAsync;

  const runSave = useCallback(async () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending == null) return;
    // Use the ids captured when the save was scheduled — NOT the currently
    // active scene — so a switch mid-debounce never PATCHes the new scene with
    // the old scene's content.
    const { content, chapterId: cid, sceneId: sid } = pending;
    if (!cid || !sid) return;
    setSaveState("saving");
    try {
      await mutateRef.current({
        chapterId: cid,
        sceneId: sid,
        patch: { content },
      });
      setSaveState("saved");
    } catch (error) {
      // Surface the failure in the StatusBar rather than swallowing it; the
      // thrown ApiError is also available on the mutation's `error` for callers.
      // Also log it so a real failure (401/network) is visible in the dev
      // console, not only as a StatusBar state (no token/secret is logged).
      console.error("Autosave failed", { sceneId: sid, error });
      setSaveState("error");
    }
  }, [setSaveState]);

  const scheduleSave = useCallback(
    (content: string) => {
      // Capture the target scene at schedule time (closure over the current
      // ids), so the queued save always targets the scene it was armed for.
      pendingRef.current = { content, chapterId, sceneId };
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSave();
      }, AUTOSAVE_DELAY_MS);
    },
    [runSave, chapterId, sceneId],
  );

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current != null) void runSave();
  }, [runSave]);

  // Flush a pending edit when the active scene changes: scene A's last keystroke
  // must persist (against A's ids, which the pending save already captured)
  // before B takes over. The cleanup runs with the PREVIOUS sceneId still in the
  // pending record, so this is safe even though the hook itself doesn't remount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingRef.current != null) void runSave();
    };
  }, [sceneId, runSave]);

  return { scheduleSave, flush };
}
