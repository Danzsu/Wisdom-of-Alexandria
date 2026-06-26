"use client";

/**
 * Verzióelőzmények (Revision History) — a right-slide panel (440px) over the
 * Write view. Lists the active scene's revisions newest-first with per-version
 * dot indicators (current / approved / draft), shows an inline diff of the
 * selected version vs the current scene text (old text struck-through in danger
 * red, new text in success green, with unchanged context), and a Restore action
 * that approves the selected revision (the backend inserts its content into the
 * scene = the restore). Built on Radix Dialog for focus-trap + Esc + scrim.
 */
import { useMemo, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { History, X, RotateCcw } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { IconButton } from "@/components/kit/icon-button";
import { StatusDot, type StatusDotVariant } from "@/components/kit/status-dot";
import { Skeleton } from "@/components/kit/skeleton";
import { EmptyState } from "@/components/kit/empty-state";
import { ErrorState } from "@/components/kit/error-state";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import { diffWords } from "@/lib/diff";
import type { DiffSegment } from "@/components/kit/diff-pane";
import {
  useRestoreRevision,
  useSceneRevisions,
} from "@/lib/api/revision-hooks";
import type { RevisionRead } from "@/lib/api/ai-types";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

export interface RevisionHistoryPanelProps {
  /** Whether the panel is open. */
  open: boolean;
  /** Open-state setter (Esc / scrim / close / successful restore call it). */
  onOpenChange: (open: boolean) => void;
  /** The scene whose revisions to list (undefined → no-scene message). */
  sceneId: string | undefined;
  /** The current persisted scene text — the left/base side of every diff. */
  sceneContent: string;
  /** The owning book (so a restore invalidates the chapter tree too). */
  bookId: string | undefined;
}

/** Dot variant + a11y label per revision status. */
function dotFor(rev: RevisionRead): { variant: StatusDotVariant; label: string } {
  return rev.approved
    ? { variant: "success", label: hu.revisionHistory.approvedDot }
    : { variant: "ai", label: hu.revisionHistory.draftDot };
}

/**
 * Interleave the two-array word diff into ONE ordered inline stream so the panel
 * renders the design's single-column diff (context + struck-through deletions +
 * green additions in document order). Replays `diffWords`' decisions: equal runs
 * advance both cursors; a deletion advances the original side; an addition
 * advances the suggestion side.
 */
function inlineDiff(before: string, after: string): DiffSegment[] {
  const { original, suggestion } = diffWords(before, after);
  const out: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < original.length || j < suggestion.length) {
    const o = original[i];
    const s = suggestion[j];
    if (o?.type === "equal" && s?.type === "equal") {
      out.push(o); // identical text on both sides — emit once, advance both
      i++;
      j++;
    } else if (o?.type === "deletion" || !s) {
      // Deletion run, or the suggestion side is exhausted → emit from original.
      if (o) out.push(o);
      i++;
    } else {
      out.push(s);
      j++;
    }
  }
  return out;
}

/** Render one inline diff segment with the design's deletion/addition styling. */
function DiffSegmentSpan({ segment }: Readonly<{ segment: DiffSegment }>) {
  if (segment.type === "deletion") {
    return (
      <span className="rounded-[3px] bg-danger-muted px-0.5 text-danger-text line-through decoration-danger">
        {segment.text}
      </span>
    );
  }
  if (segment.type === "addition") {
    return (
      <span className="rounded-[3px] bg-success-muted px-0.5 text-success-text">
        {segment.text}
      </span>
    );
  }
  return <span>{segment.text}</span>;
}

/** One selectable version row (dot + label/time + model chip). */
function VersionRow({
  rev,
  rank,
  active,
  onSelect,
}: Readonly<{
  rev: RevisionRead;
  rank: number;
  active: boolean;
  onSelect: () => void;
}>) {
  const dot = dotFor(rev);
  const when = rev.created_at.slice(0, 16).replace("T", " ");
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={hu.revisionHistory.selectAria(rank)}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 text-left transition-colors hover:border-border-strong",
        active ? "border-accent" : "border-border",
      )}
    >
      <StatusDot variant={dot.variant} size={8} aria-label={dot.label} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-text">
          {hu.revisionHistory.versionLabel(rank)}
        </span>
        <span className="block text-[11.5px] text-text-muted">{when}</span>
      </span>
      {rev.model_name ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-ai-muted px-2 py-0.5 text-[10.5px] font-semibold text-ai-text">
          {rev.model_name}
        </span>
      ) : null}
    </button>
  );
}

/** The inline diff box (or a summary / select-prompt note). */
function DiffView({
  isSummary,
  diff,
}: Readonly<{
  isSummary: boolean;
  diff: DiffSegment[] | null;
}>) {
  let body: ReactNode;
  if (isSummary) {
    body = <p className="m-0 text-text-soft">{hu.revisionHistory.summaryNote}</p>;
  } else if (diff) {
    body = (
      <p className="m-0 whitespace-pre-wrap">
        {diff.map((seg, k) => (
          <DiffSegmentSpan key={`${seg.type}-${k}`} segment={seg} />
        ))}
      </p>
    );
  } else {
    body = (
      <p className="m-0 text-text-muted">{hu.revisionHistory.selectPrompt}</p>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface-soft p-[14px] font-serif text-[13.5px] leading-[1.6] text-text-soft">
      {body}
    </div>
  );
}

/** The loaded list + diff + restore body (only mounted with a scene + data). */
function RevisionPanelBody({
  revisions,
  selected,
  isSummary,
  diff,
  restoring,
  onSelect,
  onRestore,
}: Readonly<{
  revisions: RevisionRead[];
  selected: RevisionRead | null;
  isSummary: boolean;
  diff: DiffSegment[] | null;
  restoring: boolean;
  onSelect: (id: string) => void;
  onRestore: () => void;
}>) {
  return (
    <>
      <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.07em] text-text-muted">
        {hu.revisionHistory.versionsLabel}
      </span>
      <div className="flex flex-col gap-2">
        {revisions.map((rev, idx) => (
          <VersionRow
            key={rev.id}
            rev={rev}
            rank={idx + 1}
            active={selected?.id === rev.id}
            onSelect={() => onSelect(rev.id)}
          />
        ))}
      </div>

      <span className="mb-2.5 mt-5 block text-[11px] font-semibold uppercase tracking-[0.07em] text-text-muted">
        {hu.revisionHistory.changesLabel}
      </span>
      <DiffView isSummary={isSummary} diff={diff} />

      <button
        type="button"
        onClick={onRestore}
        disabled={!selected || restoring}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[11px] border border-border bg-surface text-[13px] font-semibold text-text transition-colors hover:border-border-strong disabled:opacity-60"
      >
        {restoring ? (
          <>
            <Spinner size={14} />
            {hu.revisionHistory.restoring}
          </>
        ) : (
          <>
            <Icon icon={RotateCcw} size={14} />
            {hu.revisionHistory.restore}
          </>
        )}
      </button>
    </>
  );
}

/** Three placeholder version rows while the list loads. */
function RevisionSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {["a", "b", "c"].map((k) => (
        <div
          key={k}
          className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3"
        >
          <Skeleton width={8} height={8} className="rounded-full" />
          <div className="flex-1">
            <Skeleton width="60%" height={11} />
            <Skeleton width="40%" height={9} className="mt-1.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RevisionHistoryPanel({
  open,
  onOpenChange,
  sceneId,
  sceneContent,
  bookId,
}: Readonly<RevisionHistoryPanelProps>) {
  const revisionsQuery = useSceneRevisions(open ? sceneId : undefined);
  const restore = useRestoreRevision();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const revisions = revisionsQuery.data;
  // Default the selection to the newest revision once data lands.
  const selected = useMemo<RevisionRead | null>(() => {
    if (!revisions || revisions.length === 0) return null;
    return revisions.find((r) => r.id === selectedId) ?? revisions[0];
  }, [revisions, selectedId]);

  const isSummary = selected?.revision_type === "summarize";
  const diff = useMemo<DiffSegment[] | null>(() => {
    if (!selected || isSummary) return null;
    return inlineDiff(sceneContent, selected.content);
  }, [selected, isSummary, sceneContent]);

  const handleRestore = () => {
    if (!selected || !sceneId) return;
    restore.mutate(
      { revisionId: selected.id, sceneId, bookId },
      {
        onSuccess: () => {
          toast.success(hu.revisionHistory.restoredToast);
          onOpenChange(false);
        },
      },
    );
  };

  const hasRevisions = Boolean(revisions && revisions.length > 0);

  let content: ReactNode;
  if (!sceneId) {
    content = (
      <p className="py-6 text-center text-[13px] text-text-muted">
        {hu.revisionHistory.noScene}
      </p>
    );
  } else if (revisionsQuery.isLoading) {
    content = <RevisionSkeleton />;
  } else if (revisionsQuery.isError) {
    content = (
      <ErrorState
        message={hu.revisionHistory.error}
        detail={revisionsQuery.error?.message}
        onRetry={() => revisionsQuery.refetch()}
      />
    );
  } else if (!hasRevisions) {
    content = (
      <EmptyState
        icon={<Icon icon={History} size={20} />}
        title={hu.revisionHistory.emptyTitle}
        description={hu.revisionHistory.emptyDesc}
      />
    );
  } else {
    content = (
      <RevisionPanelBody
        revisions={revisions as RevisionRead[]}
        selected={selected}
        isSummary={Boolean(isSummary)}
        diff={diff}
        restoring={restore.isPending}
        onSelect={setSelectedId}
        onRestore={handleRestore}
      />
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[rgba(24,18,9,.45)] backdrop-blur-[3px] [animation:woaFade_.16s_ease-out]" />
        <DialogPrimitive.Content
          aria-label={hu.revisionHistory.title}
          className={cn(
            "woa-scroll fixed bottom-0 right-0 top-[52px] z-[70] flex w-[440px] max-w-[92vw] flex-col overflow-y-auto border-l border-border bg-surface shadow-modal",
            "[animation:woaSlideR_.32s_cubic-bezier(.22,1,.36,1)_both]",
          )}
        >
          {/* Sticky header: icon + title + close. */}
          <div className="sticky top-0 z-[2] flex flex-none items-center gap-2.5 border-b border-border bg-surface px-5 py-[17px]">
            <Icon icon={History} size={18} className="text-accent-text" />
            <DialogPrimitive.Title className="flex-1 font-display text-[20px] font-semibold text-text">
              {hu.revisionHistory.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {hu.revisionHistory.changesLabel}
            </DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <IconButton size={30} aria-label={hu.revisionHistory.closeAria}>
                <Icon icon={X} size={15} />
              </IconButton>
            </DialogPrimitive.Close>
          </div>

          <div className="px-5 py-[18px]">{content}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
