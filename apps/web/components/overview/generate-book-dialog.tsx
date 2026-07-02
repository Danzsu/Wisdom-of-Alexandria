"use client";

/**
 * GenerateBookDialog (book automation, V2) — the "Könyv generálása" selection
 * modal opened from the Áttekintés hero. Lists the book's chapters with the
 * generatable-scene count per row (EMPTY content AND >=1 beat — the same SAFE
 * default the backend auto-selects per chapter); the user picks which chapters
 * to run, then enqueues ONE background job (one `Revision(approved=false)` per
 * generated scene — HITL preserved, nothing auto-overwrites).
 *
 * Default-selection rules (computed in {@link useBookChaptersForGeneration};
 * this component is a pure renderer of them):
 *   - generatableCount > 0 → checked by default;
 *   - generatableCount == 0 → checkbox disabled (cannot be selected) + a hint.
 *
 * Submit fires {@link useGenerateBook} with EXACTLY the checked `chapter_ids`
 * (in listed/story order) + the continuity flag; on success a toast + close; on
 * error an error toast. The Generálás button is disabled while nothing is
 * checked or a submit is in flight.
 *
 * All copy via `hu.bookGen` (tokens only). Built on the kit Modal/ModalShell,
 * CheckboxRow, ToggleSwitch and Button — the same composition as the
 * chapter-level GenerateChapterDialog.
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
  useBookChaptersForGeneration,
  useGenerateBook,
  type BookGenChapter,
} from "@/lib/api/ai-hooks";

export interface GenerateBookDialogProps {
  /** The book whose chapters to generate. */
  bookId: string;
  /** Open state (controlled by the trigger). */
  open: boolean;
  /** Open-state change handler (close on backdrop/Esc/X and after submit). */
  onOpenChange: (open: boolean) => void;
}

/** Build the initial checked-id set from the default-selection rule. */
function defaultCheckedIds(chapters: BookGenChapter[]): Set<string> {
  return new Set(
    chapters.filter((c) => c.selectableByDefault).map((c) => c.id),
  );
}

/** The per-row hint: the generatable count, or the disabled explanation. */
function rowHint(chapter: BookGenChapter): string {
  if (chapter.generatableCount === 0) return hu.bookGen.hintNone;
  return hu.bookGen.hintGeneratable(chapter.generatableCount);
}

export function GenerateBookDialog({
  bookId,
  open,
  onOpenChange,
}: Readonly<GenerateBookDialogProps>) {
  // Only fetch while the modal is open (the data hook is disabled otherwise).
  const { chapters, isLoading, isError, error } = useBookChaptersForGeneration(
    bookId,
    open,
  );
  const generate = useGenerateBook();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [runContinuity, setRunContinuity] = useState(false);
  // Track which chapter set we've already seeded defaults for, so re-renders
  // while the modal stays open don't clobber the user's manual checks.
  const [seededFor, setSeededFor] = useState<string>("");

  // Seed the default selection once the chapters (with generatable counts)
  // resolve. Keyed on the resolved id+default signature so it re-seeds only
  // when the underlying data changes (e.g. a refetch), never on every render.
  const chapterSignature = useMemo(
    () =>
      chapters
        .map((c) => `${c.id}:${c.selectableByDefault ? 1 : 0}`)
        .join(","),
    [chapters],
  );
  useEffect(() => {
    if (!open) return;
    if (isLoading) return;
    if (seededFor === chapterSignature) return;
    setChecked(defaultCheckedIds(chapters));
    setSeededFor(chapterSignature);
  }, [open, isLoading, chapters, chapterSignature, seededFor]);

  // Reset the seed + continuity flag when the modal closes, so the next open
  // re-seeds cleanly (and a fresh book never inherits the prior selection).
  useEffect(() => {
    if (open) return;
    setSeededFor("");
    setRunContinuity(false);
  }, [open]);

  const toggleChapter = (chapterId: string, next: boolean) => {
    setChecked((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(chapterId);
      else updated.delete(chapterId);
      return updated;
    });
  };

  const checkedCount = checked.size;
  const canSubmit = checkedCount > 0 && !generate.isPending;

  const handleSubmit = () => {
    if (checkedCount === 0) return;
    // Submit the chapters in their listed (order_index / story) order, not
    // Set order — mirroring how the backend resolves the selection.
    const chapterIds = chapters
      .filter((c) => checked.has(c.id))
      .map((c) => c.id);
    generate.mutate(
      {
        bookId,
        body: { chapter_ids: chapterIds, run_continuity: runContinuity },
      },
      {
        onSuccess: () => {
          toast.success(hu.bookGen.toastStarted(chapterIds.length));
          onOpenChange(false);
        },
        onError: () => toast.error(hu.bookGen.toastError),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalShell description={hu.bookGen.subtitle} maxWidth={520}>
        <ModalHeader
          title={hu.bookGen.title}
          leadingIcon={
            <Icon icon={Sparkles} size={18} className="text-ai" aria-hidden />
          }
        />
        <ModalBody className="flex flex-col gap-4">
          <p className="m-0 text-small text-text-muted">
            {hu.bookGen.subtitle}
          </p>

          <ChapterSelectionList
            chapters={chapters}
            isLoading={isLoading}
            isError={isError}
            error={error}
            checked={checked}
            onToggle={toggleChapter}
          />

          <ToggleSwitch
            size="sm"
            label={hu.bookGen.continuityLabel}
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
            {generate.isPending ? hu.bookGen.submitting : hu.bookGen.submit}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}

interface ChapterSelectionListProps {
  chapters: BookGenChapter[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  checked: Set<string>;
  onToggle: (chapterId: string, next: boolean) => void;
}

/**
 * The chapter list region of the dialog: a loading spinner, an error state, an
 * empty-state, or the checkbox rows — exactly one, by precedence. Kept separate
 * so the dialog body stays a flat composition (no nested ternaries).
 */
function ChapterSelectionList({
  chapters,
  isLoading,
  isError,
  error,
  checked,
  onToggle,
}: Readonly<ChapterSelectionListProps>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-small text-text-muted">
        <Spinner size={16} variant="accent" label={hu.bookGen.loading} />
        <span>{hu.bookGen.loading}</span>
      </div>
    );
  }
  if (isError) {
    return <ErrorState message={hu.bookGen.error} detail={error?.message} />;
  }
  if (chapters.length === 0) {
    return (
      <p className="m-0 py-6 text-center text-small text-text-muted">
        {hu.bookGen.emptyNoChapters}
      </p>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {chapters.map((chapter) => {
        const blocked = chapter.generatableCount === 0;
        return (
          <li key={chapter.id}>
            <CheckboxRow
              label={chapter.title}
              subText={rowHint(chapter)}
              checked={checked.has(chapter.id)}
              disabled={blocked}
              onCheckedChange={(next) => onToggle(chapter.id, next === true)}
            />
          </li>
        );
      })}
    </ul>
  );
}
