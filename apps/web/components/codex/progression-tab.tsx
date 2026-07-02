"use client";

/**
 * Progresszió tab — the codex entry detail's progression timeline. A
 * progression records the entity's state at a story position:
 *
 *   - anchorless (chapter_id + scene_id NULL) → project-global BASELINE
 *   - chapter-anchored → applies from that chapter's start
 *   - scene-anchored  → applies from that scene
 *
 * The list renders in STORY ORDER, mirroring the backend AI-context
 * linearization (apps/ai `progression_service`): anchorless first `(-1,-1)`,
 * then chapter anchors `(chapter_order, -1)`, then scene anchors
 * `(chapter_order, scene_order)`, ties broken by `created_at` then id. The AI
 * pulls the LATEST at-or-before state per scene, so this order is exactly the
 * timeline the writer is authoring.
 *
 * The entity binding is ALWAYS `entity_type: "codex"` for these generic codex
 * entries — that is the key the RAG index / progression filter reads; any
 * other value would create rows the AI never sees.
 */
import { useMemo, useState } from "react";
import { Pencil, Trash2, TrendingUp } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  FieldLabel,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  SkeletonList,
  Textarea,
  toast,
} from "@/components/kit";
import { Icon } from "@/components/kit/icon";
import {
  useCodexProgressions,
  useCreateCodexProgression,
  useDeleteCodexProgression,
  useUpdateCodexProgression,
} from "@/lib/api/hooks";
import type { BookTreeResult, ChapterWithScenes } from "@/lib/api/hooks";
import type { CodexEntryRead, CodexProgressionRead } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";

/**
 * The RAG/AI-context entity key for generic codex entries (see
 * apps/ai embedding_service `_Indexable("codex", …)` + progression_service
 * `_AI_VISIBLE_MODELS["codex"]`).
 */
const CODEX_ENTITY_TYPE = "codex";

const SELECT_CLASS = cn(
  "box-border h-9 w-full rounded-lg border border-border bg-surface px-3 font-sans text-[14px] text-text outline-none",
  "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]",
);

/* -------------------------------------------------------------------------- */
/* Story-order linearization (mirrors apps/ai progression_service)            */
/* -------------------------------------------------------------------------- */

/** Sentinel "phase" placing baseline/chapter anchors before any scene. */
const BEFORE_SCENES = -1;

/** Unresolvable anchors (another book / deleted) sort after everything. */
const UNRESOLVED = Number.MAX_SAFE_INTEGER;

/** Story-position sort key for one progression within the loaded book tree. */
function storyKey(
  progression: CodexProgressionRead,
  chapters: ChapterWithScenes[],
): [number, number] {
  if (progression.scene_id) {
    for (const chapter of chapters) {
      const scene = chapter.scenes.find((s) => s.id === progression.scene_id);
      if (scene) return [chapter.order_index, scene.order_index];
    }
    return [UNRESOLVED, UNRESOLVED];
  }
  if (progression.chapter_id) {
    const chapter = chapters.find((c) => c.id === progression.chapter_id);
    if (chapter) return [chapter.order_index, BEFORE_SCENES];
    return [UNRESOLVED, UNRESOLVED];
  }
  // Anchorless = project-global baseline — before everything.
  return [BEFORE_SCENES, BEFORE_SCENES];
}

/**
 * Sort progressions into story order: baseline → chapter starts → scenes,
 * ties broken by `created_at` then id (a deterministic total order, exactly
 * like the backend linearization).
 */
export function orderProgressions(
  progressions: readonly CodexProgressionRead[],
  chapters: ChapterWithScenes[],
): CodexProgressionRead[] {
  return [...progressions].sort((a, b) => {
    const [ac, as] = storyKey(a, chapters);
    const [bc, bs] = storyKey(b, chapters);
    if (ac !== bc) return ac - bc;
    if (as !== bs) return as - bs;
    const byCreated = a.created_at.localeCompare(b.created_at);
    if (byCreated !== 0) return byCreated;
    return a.id.localeCompare(b.id);
  });
}

/** Human anchor label for a row (— / chapter / chapter · scene). */
function anchorLabel(
  progression: CodexProgressionRead,
  chapters: ChapterWithScenes[],
): string {
  if (progression.scene_id) {
    for (const chapter of chapters) {
      const scene = chapter.scenes.find((s) => s.id === progression.scene_id);
      if (scene) {
        return hu.codexProgressions.anchorScene(chapter.title, scene.title);
      }
    }
    return hu.codexProgressions.anchorUnknown;
  }
  if (progression.chapter_id) {
    const chapter = chapters.find((c) => c.id === progression.chapter_id);
    return chapter ? chapter.title : hu.codexProgressions.anchorUnknown;
  }
  return hu.codexProgressions.anchorGlobal;
}

/* -------------------------------------------------------------------------- */
/* Tab                                                                        */
/* -------------------------------------------------------------------------- */

export interface ProgressionTabProps {
  entry: CodexEntryRead;
  /** The book's chapter+scene tree (already loaded by the detail screen). */
  tree: BookTreeResult;
}

export function ProgressionTab({ entry, tree }: ProgressionTabProps) {
  const progressions = useCodexProgressions(CODEX_ENTITY_TYPE, entry.id);
  const del = useDeleteCodexProgression();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CodexProgressionRead | null>(null);

  const ordered = useMemo(
    () => orderProgressions(progressions.data ?? [], tree.chapters),
    [progressions.data, tree.chapters],
  );

  if (progressions.isError) {
    return (
      <ErrorState
        message={hu.codexProgressions.error}
        detail={progressions.error?.message ?? undefined}
        onRetry={() => void progressions.refetch()}
      />
    );
  }
  if (progressions.isLoading || tree.isLoading) {
    return <SkeletonList rows={3} />;
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(progression: CodexProgressionRead) {
    setEditing(progression);
    setModalOpen(true);
  }

  function handleDelete(progression: CodexProgressionRead) {
    del.mutate(
      {
        progressionId: progression.id,
        entityType: CODEX_ENTITY_TYPE,
        entityId: entry.id,
      },
      {
        onSuccess: () => toast.success(hu.codexProgressions.deletedToast),
        onError: (error) =>
          toast.error(`${hu.codexProgressions.deleteError}: ${error.message}`),
      },
    );
  }

  const modal = (
    <ProgressionModal
      key={editing?.id ?? "new"}
      open={modalOpen}
      onOpenChange={setModalOpen}
      entryId={entry.id}
      chapters={tree.chapters}
      editing={editing}
    />
  );

  if (ordered.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Icon icon={TrendingUp} size={22} />}
          title={hu.codexProgressions.emptyTitle}
          description={hu.codexProgressions.emptyHint}
          action={{
            label: hu.codexProgressions.emptyCta,
            onClick: openCreate,
          }}
        />
        {modal}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button variant="accent-outline" size={32} onClick={openCreate}>
          {hu.codexProgressions.addNew}
        </Button>
      </div>

      <ul
        aria-label={hu.codexProgressions.listAria}
        className="m-0 flex list-none flex-col gap-1.5 p-0"
      >
        {ordered.map((progression) => {
          const note = progression.note ?? hu.codexProgressions.noNote;
          return (
            <li
              key={progression.id}
              className="flex items-start gap-3 rounded-[10px] border border-border bg-surface px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  {anchorLabel(progression, tree.chapters)}
                </p>
                <p className="m-0 mt-1 text-[13px] leading-[1.5] text-text">
                  {note}
                </p>
              </div>
              <div className="flex flex-none items-center gap-1.5">
                <button
                  type="button"
                  aria-label={hu.codexProgressions.editAria(note)}
                  onClick={() => openEdit(progression)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:border-accent hover:bg-accent-muted hover:text-accent-text"
                >
                  <Icon icon={Pencil} size={13} />
                </button>
                <button
                  type="button"
                  aria-label={hu.codexProgressions.deleteAria(note)}
                  onClick={() => handleDelete(progression)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:border-danger hover:bg-danger-muted hover:text-danger-text"
                >
                  <Icon icon={Trash2} size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {modal}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Create / edit modal                                                        */
/* -------------------------------------------------------------------------- */

interface ProgressionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  chapters: ChapterWithScenes[];
  /** When set, the modal edits this progression (prefilled → PATCH). */
  editing: CodexProgressionRead | null;
}

/**
 * Anchor picker (cascading: chapter → its scenes) + a required note. Create
 * POSTs a full `CodexProgressionCreate`; edit PATCHes the anchor + note with
 * ALL fields explicit so clearing an anchor persists (backend `exclude_unset`).
 */
function ProgressionModal({
  open,
  onOpenChange,
  entryId,
  chapters,
  editing,
}: ProgressionModalProps) {
  // Prefill: a scene-anchored row may have chapter_id NULL — derive the
  // chapter from the tree so the cascading selects render consistently.
  const initialChapterId =
    editing?.chapter_id ??
    (editing?.scene_id
      ? chapters.find((c) =>
          c.scenes.some((s) => s.id === editing.scene_id),
        )?.id ?? ""
      : "") ??
    "";
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [sceneId, setSceneId] = useState(editing?.scene_id ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const create = useCreateCodexProgression();
  const update = useUpdateCodexProgression();

  const selectedChapter = chapters.find((c) => c.id === chapterId);

  function reset() {
    setChapterId(initialChapterId);
    setSceneId(editing?.scene_id ?? "");
    setNote(editing?.note ?? "");
    setFieldError(null);
    setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleChapterChange(next: string) {
    setChapterId(next);
    // A chapter change invalidates the previously picked scene.
    setSceneId("");
  }

  function handleSubmit() {
    setFieldError(null);
    setSubmitError(null);
    const trimmed = note.trim();
    if (!trimmed) {
      setFieldError(hu.codexProgressions.modalNoteRequired);
      return;
    }
    const anchor = {
      chapter_id: chapterId ? chapterId : null,
      scene_id: sceneId ? sceneId : null,
    };
    const callbacks = (successToast: string, errorLabel: string) => ({
      onSuccess: () => {
        toast.success(successToast);
        handleOpenChange(false);
      },
      onError: (error: Error) => {
        // Surface the failure inline + toast; never swallow it.
        setSubmitError(error.message);
        toast.error(errorLabel);
      },
    });
    if (editing) {
      update.mutate(
        {
          progressionId: editing.id,
          patch: { ...anchor, note: trimmed },
        },
        callbacks(
          hu.codexProgressions.updatedToast,
          hu.codexProgressions.updateError,
        ),
      );
    } else {
      create.mutate(
        {
          entity_type: CODEX_ENTITY_TYPE,
          entity_id: entryId,
          ...anchor,
          note: trimmed,
        },
        callbacks(
          hu.codexProgressions.createdToast,
          hu.codexProgressions.createError,
        ),
      );
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={480}>
        <ModalHeader
          title={
            editing
              ? hu.codexProgressions.modalTitleEdit
              : hu.codexProgressions.modalTitleNew
          }
        />
        <ModalBody>
          <div className="flex flex-col gap-3.5">
            <div>
              <FieldLabel htmlFor="prog-anchor">
                {hu.codexProgressions.modalAnchorLabel}
              </FieldLabel>
              <p className="m-0 mb-[7px] text-[12px] text-text-muted">
                {hu.codexProgressions.modalAnchorHint}
              </p>
              <select
                id="prog-anchor"
                className={SELECT_CLASS}
                value={chapterId}
                onChange={(e) => handleChapterChange(e.target.value)}
              >
                <option value="">
                  {hu.codexProgressions.modalAnchorGlobal}
                </option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedChapter ? (
              <div>
                <FieldLabel htmlFor="prog-scene">
                  {hu.codexProgressions.modalSceneLabel}
                </FieldLabel>
                <select
                  id="prog-scene"
                  className={SELECT_CLASS}
                  value={sceneId}
                  onChange={(e) => setSceneId(e.target.value)}
                >
                  <option value="">
                    {hu.codexProgressions.modalSceneChapterStart}
                  </option>
                  {selectedChapter.scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <FieldLabel htmlFor="prog-note">
                {hu.codexProgressions.modalNoteLabel}
              </FieldLabel>
              <Textarea
                id="prog-note"
                rows={4}
                placeholder={hu.codexProgressions.modalNotePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {fieldError ? (
              <p role="alert" className="m-0 text-[12px] text-danger-text">
                {fieldError}
              </p>
            ) : null}
            {submitError ? (
              <p role="alert" className="m-0 text-[12px] text-danger-text">
                {submitError}
              </p>
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            {hu.codexProgressions.modalCancel}
          </Button>
          <Button variant="cta" disabled={pending} onClick={handleSubmit}>
            {editing
              ? hu.codexProgressions.modalSave
              : hu.codexProgressions.modalCreate}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}
