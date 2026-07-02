"use client";

import { useMemo, useState } from "react";
import { GripVertical, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/kit/button";
import { EmptyState } from "@/components/kit/empty-state";
import { Icon } from "@/components/kit/icon";
import { IconButton } from "@/components/kit/icon-button";
import { Skeleton } from "@/components/kit/skeleton";
import { Textarea } from "@/components/kit/textarea";
import { toast } from "@/components/kit/toast";
import { dndTransformToCss } from "@/components/plan/dnd-transform";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import {
  useCreateBeat,
  useDeleteBeat,
  useReorderBeats,
  useSceneBeats,
  useUpdateBeat,
} from "@/lib/api/hooks";
import type { BeatRead } from "@/lib/api/types";

export interface SceneBeatsPanelProps {
  /** The ACTIVE scene id — undefined when no scene is open (e.g. board view). */
  sceneId: string | undefined;
}

/**
 * The scene-level beat editor (inspector "Beatek" tab): the ACTIVE scene's
 * beats in `order_index` order, each row with a drag handle (dnd-kit vertical
 * sort — pointer + keyboard sensors), an edit-in-place description form
 * (PATCH), an optional `beat_type` badge and a delete action; an "Új beat"
 * composer appends (POST). A drop persists the FULL new id order via the
 * dedicated reorder endpoint, optimistically (see `useReorderBeats`). All
 * mutations invalidate the shared `sceneBeats` query key, so the Scene
 * Metadata modal's beat count and the chapter-generate dialog's gating stay
 * fresh. Loading / empty / error / no-scene states are honest.
 */
export function SceneBeatsPanel({ sceneId }: Readonly<SceneBeatsPanelProps>) {
  const beatsQuery = useSceneBeats(sceneId);
  const createBeat = useCreateBeat();
  const reorderBeats = useReorderBeats();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Pointer (6px activation keeps row-button clicks working) + keyboard
  // sensors — the drag handles are keyboard-operable.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Render in order_index order regardless of the response array order.
  const ordered = useMemo(
    () =>
      [...(beatsQuery.data ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      ),
    [beatsQuery.data],
  );

  if (!sceneId) {
    return (
      <p className="m-0 text-[12px] text-text-muted">{hu.beats.noScene}</p>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!sceneId || !over || active.id === over.id) return;
    const ids = ordered.map((beat) => beat.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderBeats.mutate(
      { sceneId, order: arrayMove(ids, from, to) },
      { onError: () => toast.error(hu.beats.reorderError) },
    );
  }

  function handleAdd() {
    const description = draft.trim();
    if (!description || !sceneId) return;
    createBeat.mutate(
      { sceneId, data: { description, order_index: ordered.length } },
      {
        onSuccess: () => setDraft(""),
        onError: () => toast.error(hu.beats.addError),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {hu.beats.heading}
      </p>

      {beatsQuery.isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton height={54} />
          <Skeleton height={54} />
          <Skeleton height={54} />
        </div>
      ) : beatsQuery.isError ? (
        <p className="m-0 text-[12px] text-danger-text" role="alert">
          {hu.beats.loadError}
        </p>
      ) : ordered.length === 0 ? (
        <EmptyState
          icon={<Icon icon={ListChecks} size={20} />}
          title={hu.beats.empty}
          description={hu.beats.emptyHint}
          className="px-3 py-8"
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ordered.map((beat) => beat.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol
              aria-label={hu.beats.listAria}
              className="m-0 flex list-none flex-col gap-2 p-0"
            >
              {ordered.map((beat, i) => (
                <SortableBeatRow
                  key={beat.id}
                  beat={beat}
                  position={i + 1}
                  sceneId={sceneId}
                  editing={editingId === beat.id}
                  onEditStart={() => setEditingId(beat.id)}
                  onEditEnd={() => setEditingId(null)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {/* Composer — appends a new beat at the end of the list. */}
      <div className="flex flex-col gap-2">
        <Textarea
          aria-label={hu.beats.composerLabel}
          placeholder={hu.beats.composerPlaceholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          className="resize-none"
        />
        <Button
          variant="dashed"
          onClick={handleAdd}
          disabled={draft.trim().length === 0 || createBeat.isPending}
          loading={createBeat.isPending}
          leadingIcon={<Icon icon={Plus} size={12} />}
        >
          {hu.beats.addButton}
        </Button>
      </div>
    </div>
  );
}

interface SortableBeatRowProps {
  beat: BeatRead;
  /** 1-based display position — used in the row-affordance aria-labels. */
  position: number;
  sceneId: string;
  editing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
}

/**
 * One sortable beat row: grip (drag activator) + serif description + edit and
 * delete affordances, or the edit-in-place form while `editing`. Reuses the
 * beat-card look of the previous Beatek tab (accent left edge on surface).
 */
function SortableBeatRow({
  beat,
  position,
  sceneId,
  editing,
  onEditStart,
  onEditEnd,
}: Readonly<SortableBeatRowProps>) {
  const updateBeat = useUpdateBeat();
  const deleteBeat = useDeleteBeat();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: beat.id });

  function handleDelete() {
    deleteBeat.mutate(
      { sceneId, beatId: beat.id },
      {
        onSuccess: () => toast.success(hu.beats.toastDeleted),
        onError: () => toast.error(hu.beats.deleteError),
      },
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: dndTransformToCss(transform), transition }}
      className={cn(
        "flex flex-col gap-1.5 rounded-[10px] border border-l-[3px] border-border border-l-accent bg-surface p-[11px]",
        isDragging && "opacity-60 shadow-card",
      )}
    >
      {editing ? (
        <BeatEditForm
          beat={beat}
          pending={updateBeat.isPending}
          onSave={(description) =>
            updateBeat.mutate(
              { sceneId, beatId: beat.id, patch: { description } },
              {
                onSuccess: onEditEnd,
                onError: () => toast.error(hu.beats.updateError),
              },
            )
          }
          onCancel={onEditEnd}
        />
      ) : (
        <>
          <div className="flex items-start gap-1.5">
            <button
              type="button"
              ref={setActivatorNodeRef}
              aria-label={hu.beats.dragHandleAria(position)}
              className="mt-px flex flex-none cursor-grab items-center border-none bg-transparent p-0 text-text-faint hover:text-text-muted active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <Icon icon={GripVertical} size={12} />
            </button>
            <p className="m-0 flex-1 font-serif text-[13px] leading-[1.55] text-text-soft">
              {beat.description}
            </p>
            <IconButton
              size={24}
              aria-label={hu.beats.editAria(position)}
              onClick={onEditStart}
            >
              <Icon icon={Pencil} size={12} />
            </IconButton>
            <IconButton
              size={24}
              variant="danger"
              aria-label={hu.beats.deleteAria(position)}
              onClick={handleDelete}
              disabled={deleteBeat.isPending}
            >
              <Icon icon={Trash2} size={12} />
            </IconButton>
          </div>
          {beat.beat_type ? (
            <span className="ml-[19px] w-fit rounded-full bg-accent-muted px-2 py-0.5 text-[10.5px] font-semibold text-accent-text">
              {beat.beat_type}
            </span>
          ) : null}
        </>
      )}
    </li>
  );
}

interface BeatEditFormProps {
  beat: BeatRead;
  pending: boolean;
  onSave: (description: string) => void;
  onCancel: () => void;
}

/**
 * The edit-in-place form for one beat. Mounted only while its row is in edit
 * mode, so the local draft state initialises from the CURRENT description.
 */
function BeatEditForm({
  beat,
  pending,
  onSave,
  onCancel,
}: Readonly<BeatEditFormProps>) {
  const [text, setText] = useState(beat.description);
  const trimmed = text.trim();

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={hu.beats.editLabel}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        variant="manuscript"
        className="resize-none"
      />
      <div className="flex gap-2">
        <Button
          variant="cta"
          size={28}
          onClick={() => onSave(trimmed)}
          disabled={trimmed.length === 0 || pending}
          loading={pending}
        >
          {hu.beats.save}
        </Button>
        <Button variant="ghost" size={28} onClick={onCancel} disabled={pending}>
          {hu.beats.cancel}
        </Button>
      </div>
    </div>
  );
}
