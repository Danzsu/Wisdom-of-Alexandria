"use client";

/**
 * GenerateChapterDialog (chapter automation, T4) — the "Fejezet generálása"
 * selection modal. Lists the chapter's scenes; the user picks exactly which to
 * generate from their beats, then enqueues ONE background job (one
 * `Revision(approved=false)` per scene — HITL preserved, nothing auto-overwrites).
 *
 * Default-selection rules (computed in {@link useChapterScenesForGeneration};
 * this component is a pure renderer of them):
 *   - EMPTY (no text) AND beat_count > 0 → checked by default;
 *   - non-empty AND beat_count > 0       → rendered, UNCHECKED, with a hint;
 *   - beat_count == 0                    → checkbox disabled (cannot be selected).
 *
 * Submit fires {@link useGenerateChapter} with EXACTLY the checked `scene_ids` +
 * the continuity flag; on success a toast + close; on error an error toast. The
 * Generálás button is disabled while nothing is checked or a submit is in flight.
 *
 * All copy via `hu.chapterGen` (tokens only). Built on the kit Modal/ModalShell,
 * CheckboxRow, ToggleSwitch and Button.
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Modal,
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/kit/modal-shell";
import { Button } from "@/components/kit/button";
import { CheckboxRow } from "@/components/kit/checkbox-row";
import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { ErrorState } from "@/components/kit/error-state";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import {
  useChapterScenesForGeneration,
  useGenerateChapter,
  type ChapterGenScene,
} from "@/lib/api/ai-hooks";

export interface GenerateChapterDialogProps {
  /** The chapter to generate scenes for. */
  chapterId: string;
  /** The chapter title (shown in the header). */
  chapterTitle: string;
  /** Open state (controlled by the trigger). */
  open: boolean;
  /** Open-state change handler (close on backdrop/Esc/X and after submit). */
  onOpenChange: (open: boolean) => void;
}

/** Build the initial checked-id set from the default-selection rule. */
function defaultCheckedIds(scenes: ChapterGenScene[]): Set<string> {
  return new Set(
    scenes.filter((s) => s.selectableByDefault).map((s) => s.id),
  );
}

/** The per-row hint: no-beats > empty > has-text (mutually exclusive). */
function rowHint(scene: ChapterGenScene): string {
  if (scene.beatCount === 0) return hu.chapterGen.hintNoBeats;
  if (scene.isEmpty) return hu.chapterGen.hintEmpty;
  return hu.chapterGen.hintHasText;
}

export function GenerateChapterDialog({
  chapterId,
  chapterTitle,
  open,
  onOpenChange,
}: Readonly<GenerateChapterDialogProps>) {
  // Only fetch while the modal is open (the data hook is disabled otherwise).
  const { scenes, isLoading, isError, error } = useChapterScenesForGeneration(
    chapterId,
    open,
  );
  const generate = useGenerateChapter();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [runContinuity, setRunContinuity] = useState(false);
  // Track which scene set we've already seeded defaults for, so re-renders while
  // the modal stays open don't clobber the user's manual checks.
  const [seededFor, setSeededFor] = useState<string>("");

  // Seed the default selection once the scenes (with beat counts) resolve. Keyed
  // on the resolved id+default signature so it re-seeds only when the underlying
  // data changes (e.g. a refetch), never on every render.
  const sceneSignature = useMemo(
    () => scenes.map((s) => `${s.id}:${s.selectableByDefault ? 1 : 0}`).join(","),
    [scenes],
  );
  useEffect(() => {
    if (!open) return;
    if (isLoading) return;
    if (seededFor === sceneSignature) return;
    setChecked(defaultCheckedIds(scenes));
    setSeededFor(sceneSignature);
  }, [open, isLoading, scenes, sceneSignature, seededFor]);

  // Reset the seed + continuity flag when the modal closes, so the next open
  // re-seeds cleanly (and a fresh chapter never inherits the prior selection).
  useEffect(() => {
    if (open) return;
    setSeededFor("");
    setRunContinuity(false);
  }, [open]);

  const toggleScene = (sceneId: string, next: boolean) => {
    setChecked((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(sceneId);
      else updated.delete(sceneId);
      return updated;
    });
  };

  const checkedCount = checked.size;
  const canSubmit = checkedCount > 0 && !generate.isPending;

  const handleSubmit = () => {
    if (checkedCount === 0) return;
    // Submit the scenes in their listed (order_index) order, not Set order.
    const sceneIds = scenes
      .filter((s) => checked.has(s.id))
      .map((s) => s.id);
    generate.mutate(
      { chapterId, body: { scene_ids: sceneIds, run_continuity: runContinuity } },
      {
        onSuccess: () => {
          toast.success(hu.chapterGen.toastStarted(sceneIds.length));
          onOpenChange(false);
        },
        onError: () => toast.error(hu.chapterGen.toastError),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalShell description={hu.chapterGen.subtitle} maxWidth={520}>
        <ModalHeader
          title={`${hu.chapterGen.title} — ${chapterTitle}`}
          leadingIcon={
            <Icon icon={Sparkles} size={18} className="text-ai" aria-hidden />
          }
        />
        <ModalBody className="flex flex-col gap-4">
          <p className="m-0 text-small text-text-muted">
            {hu.chapterGen.subtitle}
          </p>

          <SceneSelectionList
            scenes={scenes}
            isLoading={isLoading}
            isError={isError}
            error={error}
            checked={checked}
            onToggle={toggleScene}
          />

          <ToggleSwitch
            size="sm"
            label={hu.chapterGen.continuityLabel}
            checked={runContinuity}
            onCheckedChange={(next) => setRunContinuity(next === true)}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="cta"
            disabled={!canSubmit}
            loading={generate.isPending}
            onClick={handleSubmit}
          >
            {generate.isPending
              ? hu.chapterGen.submitting
              : hu.chapterGen.submit}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}

interface SceneSelectionListProps {
  scenes: ChapterGenScene[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  checked: Set<string>;
  onToggle: (sceneId: string, next: boolean) => void;
}

/**
 * The scene list region of the dialog: a loading spinner, an error state, an
 * empty-state, or the checkbox rows — exactly one, by precedence. Kept separate
 * so the dialog body stays a flat composition (no nested ternaries).
 */
function SceneSelectionList({
  scenes,
  isLoading,
  isError,
  error,
  checked,
  onToggle,
}: Readonly<SceneSelectionListProps>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-small text-text-muted">
        <Spinner size={16} variant="accent" label={hu.chapterGen.loading} />
        <span>{hu.chapterGen.loading}</span>
      </div>
    );
  }
  if (isError) {
    return <ErrorState message={hu.chapterGen.error} detail={error?.message} />;
  }
  if (scenes.length === 0) {
    return (
      <p className="m-0 py-6 text-center text-small text-text-muted">
        {hu.chapterGen.emptyNoScenes}
      </p>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {scenes.map((scene) => {
        const noBeats = scene.beatCount === 0;
        return (
          <li key={scene.id}>
            <CheckboxRow
              label={scene.title}
              subText={rowHint(scene)}
              checked={checked.has(scene.id)}
              disabled={noBeats}
              onCheckedChange={(next) => onToggle(scene.id, next === true)}
            />
          </li>
        );
      })}
    </ul>
  );
}
