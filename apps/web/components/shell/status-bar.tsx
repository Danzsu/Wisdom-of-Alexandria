"use client";

import { useParams } from "next/navigation";
import { Check, Cpu } from "lucide-react";
import { Button } from "@/components/kit/button";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import {
  useBookTree,
  findSceneLocation,
} from "@/lib/api/hooks";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useInspectorModels } from "@/components/inspector/use-inspector-models";
import { formatHu } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";

/**
 * 32px footer status bar (Write route only). Shows the LIVE word count
 * (tabular-nums), the chapter/scene location resolved from the book tree, the
 * autosave state ("Mentés…" / "Mentve ✓" / error) and the ACTIVE model badge.
 * Word count + save state come from the editor store (written by the editor);
 * the model badge is the config-driven active model (ModelSelector / config),
 * never a hardcoded name.
 */
export function StatusBar() {
  const params = useParams<{ bookId: string; sceneId?: string }>();
  const bookId = params?.bookId;
  const sceneId = params?.sceneId;

  const tree = useBookTree(bookId);
  const wordCount = useEditorStore((s) => s.wordCount);
  const saveState = useEditorStore((s) => s.saveState);
  const retrySave = useEditorStore((s) => s.retrySave);
  const models = useInspectorModels();
  const activeModel = models.value || hu.inspector.metaUnknown;

  const location =
    sceneId && tree.chapters.length > 0
      ? findSceneLocation(tree.chapters, sceneId)
      : null;
  const locationText = location
    ? `${location.chapter.title}, ${location.scene.title}`
    : hu.statusbar.locationPlaceholder;

  return (
    <footer className="flex h-statusbar flex-none items-center gap-3 border-t border-border bg-surface px-4 text-[12px] text-text-muted">
      <span className="tabular-nums">
        {hu.statusbar.wordCount(formatHu(wordCount))}
      </span>
      <span aria-hidden="true" className="text-border-strong">
        ·
      </span>
      <span className="truncate">{locationText}</span>
      <div className="flex-1" />
      {/* Live region so autosave failures ("Mentés sikertelen") are announced. */}
      <span role="status" aria-live="polite" className="flex items-center">
        <SaveState saveState={saveState} onRetry={retrySave} />
      </span>
      <div className="flex-1" />
      <span className="flex h-5 items-center gap-1.5 rounded-full bg-ai-muted px-2 text-[11px] font-semibold text-ai-text">
        <Icon icon={Cpu} size={11} />
        {activeModel} {hu.statusbar.modelLocalSuffix}
      </span>
    </footer>
  );
}

/** The save-state segment of the status bar. */
function SaveState({
  saveState,
  onRetry,
}: {
  saveState: string;
  /** Manual-retry bridge from the autosave hook; `null` off the Write view. */
  onRetry: (() => void) | null;
}) {
  if (saveState === "saving" || saveState === "retrying") {
    return (
      <span className="flex items-center gap-1.5 text-text-muted">
        <Spinner size={11} />
        {saveState === "retrying" ? hu.statusbar.retrying : hu.statusbar.saving}
      </span>
    );
  }
  if (saveState === "error") {
    // Auto-retries are exhausted — "Mentés sikertelen — Újra" with a live
    // manual retry (the button re-fires the failed payload via the store
    // bridge the autosave hook registered).
    return (
      <span className="flex items-center gap-1.5 text-danger-text">
        {hu.statusbar.error}
        {onRetry ? (
          <>
            <span aria-hidden="true">—</span>
            <Button
              variant="ghost"
              shape="pill"
              size={28}
              aria-label={hu.statusbar.retryAria}
              onClick={onRetry}
              className="h-5 px-1.5 text-[12px] font-semibold text-danger-text hover:bg-danger-muted hover:text-danger-text"
            >
              {hu.statusbar.retry}
            </Button>
          </>
        ) : null}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-success-text">
      <Icon icon={Check} size={12} strokeWidth={2} />
      {hu.statusbar.saved}
    </span>
  );
}
