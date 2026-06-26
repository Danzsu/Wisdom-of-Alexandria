"use client";

/**
 * Scene Metadata modal (design-delta Task 4 — faithful copy of
 * `Alexandria.current.html` ~line 1706). A centred ~440px modal showing a
 * scene's metadata with quick actions. Built on the kit `Modal` / `ModalShell`
 * (Radix Dialog → focus-trap + Esc for free) so it stays consistent with the
 * rest of the app's overlays.
 *
 * Data binding (all REAL, no fabrication):
 * - title / summary / status come from the `PlanScene` view-model,
 * - the POV badge + name come from `scene.pov` (resolved upstream against the
 *   Codex by `use-plan-board.ts`),
 * - the word count is the backend-computed `scene.raw.word_count`,
 * - the beat count is fetched live via `useSceneBeats(scene.id)`.
 *
 * Honest gaps (reported, not faked):
 * - There is NO scene→location link in the data model (a Scene only has a
 *   `pov_character_id`), so the "Helyszín" field renders the em-dash
 *   placeholder rather than inventing a location.
 * - There is no continuity-warning data source for a scene, so the optional
 *   warning row from the prototype is OMITTED entirely (per the task: show only
 *   if available, never fabricate).
 *
 * Actions:
 * - "Késznek jelölöm" → PATCH the scene's status to `complete` via
 *   `useUpdateScene` (shown only when not already complete); success → toast +
 *   the cache updates flow through the shared mutation, reflecting the new
 *   status, then the modal closes.
 * - "Megnyitás a szerkesztőben" → navigate to the Write route for the scene.
 * - "Beatek" → navigate to the scene's editor (the beats inspector lives in the
 *   Write view); a dedicated standalone beats route does not exist, so this is
 *   the cleanest existing destination.
 */
import { Check, PenLine, TriangleAlert } from "lucide-react";
import {
  Modal,
  ModalShell,
  ModalClose,
} from "@/components/kit/modal-shell";
import { Icon } from "@/components/kit/icon";
import { toast } from "@/components/kit/toast";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { routes } from "@/lib/routes";
import { useNavTo } from "@/lib/use-nav-to";
import { sceneStatusPresentation } from "@/lib/scene-status";
import { useSceneBeats, useUpdateScene } from "@/lib/api/hooks";
import { povBadgeClass } from "./pov-badge-class";
import type { PlanScene } from "./types";

export interface SceneMetadataModalProps {
  /** The scene whose metadata to show (status + POV already resolved). */
  scene: PlanScene;
  /** The owning book id — needed to build the Write route. */
  bookId: string;
  /** Continuity warning label — rendered only when a real warning is supplied. */
  continuityWarning?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Format a word count with Hungarian thin-space grouping, tabular-friendly. */
function formatWordCount(n: number): string {
  return new Intl.NumberFormat("hu-HU").format(n);
}

export function SceneMetadataModal({
  scene,
  bookId,
  continuityWarning,
  open,
  onOpenChange,
}: Readonly<SceneMetadataModalProps>) {
  const navTo = useNavTo();
  const updateScene = useUpdateScene();
  // Fetch beats only while the modal is open (closed → no query fires).
  const beatsQuery = useSceneBeats(open ? scene.id : undefined);
  const beatCount = beatsQuery.data?.length;

  const status = sceneStatusPresentation(scene.status);
  // The scene can be marked done only when it is not already complete.
  const canMarkDone = scene.status !== "complete";
  const povBadge = scene.pov[0];
  const povLabel = povBadge?.label ?? hu.sceneMeta.valueNone;

  function handleMarkDone() {
    updateScene.mutate(
      {
        chapterId: scene.raw.chapter_id,
        sceneId: scene.id,
        patch: { status: "complete" },
      },
      {
        onSuccess: () => {
          toast.success(hu.sceneMeta.toastMarkedDone);
          onOpenChange(false);
        },
        onError: () => toast.error(hu.sceneMeta.errorMarkDone),
      },
    );
  }

  function handleOpenInEditor() {
    onOpenChange(false);
    navTo(routes.scene(bookId, scene.id));
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalShell
        maxWidth={440}
        title={hu.sceneMeta.dialogTitle}
        className="gap-0"
      >
        {/* Header: POV badge + status seal + close, then title + summary. */}
        <div className="flex flex-none flex-col gap-2.5 border-b border-border px-[22px] pb-4 pt-5">
          <div className="flex items-center gap-[7px]">
            {povBadge ? (
              <span
                className={cn(
                  "flex h-[19px] items-center rounded-full px-2 text-[11px] font-semibold",
                  povBadgeClass(povBadge.slot),
                )}
              >
                {povLabel}
              </span>
            ) : null}
            <span className="flex h-[20px] items-center gap-[5px] rounded-full bg-surface-muted px-2.5 text-[11px] font-semibold text-text-muted">
              <span
                className={cn("h-[7px] w-[7px] rounded-full", status.dotClass)}
                aria-hidden="true"
              />
              {status.label}
            </span>
            <ModalClose label={hu.sceneMeta.closeAria} className="ml-auto" />
          </div>
          <h2 className="m-0 font-display text-[24px] font-semibold leading-[1.12] text-text">
            {scene.title}
          </h2>
          <p className="m-0 text-[13.5px] leading-[1.55] text-text-muted [text-wrap:pretty]">
            {scene.summary || hu.sceneMeta.summaryPlaceholder}
          </p>
        </div>

        {/* Metadata grid + optional warning + actions. */}
        <div className="flex flex-col px-[22px] py-4">
          <dl className="mb-3.5 grid grid-cols-2 gap-[11px]">
            <MetaField label={hu.sceneMeta.labelPov} value={povLabel} />
            <MetaField
              label={hu.sceneMeta.labelLocation}
              value={hu.sceneMeta.valueNone}
            />
            <MetaField
              label={hu.sceneMeta.labelWordCount}
              value={formatWordCount(scene.raw.word_count)}
              tabular
            />
            <MetaField
              label={hu.sceneMeta.labelBeats}
              value={beatCount === undefined ? "…" : `${beatCount}`}
              tabular
            />
          </dl>

          {continuityWarning ? (
            <div className="mb-3.5 flex items-center gap-[9px] rounded-[11px] bg-warning-muted px-[13px] py-[11px]">
              <Icon
                icon={TriangleAlert}
                size={15}
                className="flex-none text-warning-text"
              />
              <span className="text-[12.5px] font-semibold text-warning-text">
                {continuityWarning}
              </span>
            </div>
          ) : null}

          {canMarkDone ? (
            <button
              type="button"
              onClick={handleMarkDone}
              disabled={updateScene.isPending}
              className="mb-2.5 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[11px] border border-success/40 bg-gradient-to-b from-success/15 to-success/5 text-[13.5px] font-semibold text-success-text disabled:opacity-60"
            >
              <Icon icon={Check} size={16} />
              {hu.sceneMeta.markDone}
            </button>
          ) : null}

          <div className="flex gap-[9px]">
            <button
              type="button"
              onClick={handleOpenInEditor}
              className="inline-flex h-[42px] flex-1 items-center justify-center gap-[7px] rounded-[11px] bg-accent-strong text-[13.5px] font-semibold text-accent-fg shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_28%,transparent)]"
            >
              <Icon icon={PenLine} size={15} />
              {hu.sceneMeta.openInEditor}
            </button>
            <button
              type="button"
              onClick={handleOpenInEditor}
              className="inline-flex h-[42px] items-center justify-center rounded-[11px] border border-border bg-surface px-4 text-[13.5px] font-semibold text-text hover:border-border-strong"
            >
              {hu.sceneMeta.beats}
            </button>
          </div>
        </div>
      </ModalShell>
    </Modal>
  );
}

/** A single label/value cell in the metadata grid. */
function MetaField({
  label,
  value,
  tabular = false,
}: Readonly<{
  label: string;
  value: string;
  tabular?: boolean;
}>) {
  return (
    <div className="flex flex-col gap-[3px]">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 text-[14px] text-text",
          tabular && "tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
