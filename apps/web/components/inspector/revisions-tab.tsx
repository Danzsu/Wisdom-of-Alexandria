"use client";

/**
 * Revíziók (revision browser) inspector tab.
 *
 * Lists the active scene's revision history (the human-in-the-loop record of
 * every AI generation). Each entry shows a word-level diff of the current scene
 * text vs the revision, with Restore (approve → overwrites the scene) and Reject
 * (discard) actions. Summarize revisions are shown as plain text (they target a
 * summary field, not the manuscript, so a content diff would mislead).
 */
import { useMemo } from "react";
import { DiffPane } from "@/components/kit/diff-pane";
import { Button } from "@/components/kit";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import { diffWords } from "@/lib/diff";
import {
  useRejectRevision,
  useRestoreRevision,
  useSceneRevisions,
} from "@/lib/api/revision-hooks";
import type { RevisionRead } from "@/lib/api/ai-types";
import { hu } from "@/lib/i18n/hu";
import { useInspectorScene } from "./use-inspector-scene";

export function RevisionsTab() {
  const { scene, sceneId, bookId, isLoading: sceneLoading } = useInspectorScene();
  const revisionsQuery = useSceneRevisions(sceneId);
  const restore = useRestoreRevision();
  const reject = useRejectRevision();

  const revisions = revisionsQuery.data;
  const pendingId =
    restore.isPending
      ? restore.variables?.revisionId
      : reject.isPending
        ? reject.variables?.revisionId
        : undefined;

  if (sceneLoading || revisionsQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner label={hu.revisions.loading} />
      </div>
    );
  }
  if (revisionsQuery.isError) {
    return (
      <p className="py-6 text-center text-[13px] text-danger" role="status">
        {hu.revisions.error}
      </p>
    );
  }
  if (!sceneId) {
    return (
      <p className="py-6 text-center text-[13px] text-text-muted">
        {hu.revisions.noScene}
      </p>
    );
  }
  if (!revisions || revisions.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-text-muted">
        {hu.revisions.empty}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {revisions.map((rev) => (
        <RevisionCard
          key={rev.id}
          revision={rev}
          sceneContent={scene?.content ?? ""}
          busy={pendingId === rev.id}
          onRestore={() =>
            restore.mutate(
              { revisionId: rev.id, sceneId, bookId },
              { onSuccess: () => toast.success(hu.revisions.restoredToast) },
            )
          }
          onReject={() =>
            reject.mutate(
              { revisionId: rev.id, sceneId, bookId },
              { onSuccess: () => toast.info(hu.revisions.rejectedToast) },
            )
          }
        />
      ))}
    </div>
  );
}

function RevisionCard({
  revision,
  sceneContent,
  busy,
  onRestore,
  onReject,
}: {
  revision: RevisionRead;
  sceneContent: string;
  busy: boolean;
  onRestore: () => void;
  onReject: () => void;
}) {
  const isSummary = revision.revision_type === "summarize";
  const diff = useMemo(
    () => (isSummary ? null : diffWords(sceneContent, revision.content)),
    [isSummary, sceneContent, revision.content],
  );
  const when = revision.created_at.slice(0, 16).replace("T", " ");

  return (
    <article className="rounded-xl border border-border bg-surface p-3 shadow-card">
      <header className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
        <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold text-text-soft">
          {revision.revision_type}
        </span>
        {revision.model_name ? <span>{revision.model_name}</span> : null}
        <span className="text-text-faint">·</span>
        <span>{when}</span>
        {revision.approved ? (
          <span className="rounded-full bg-success-muted px-2 py-0.5 font-semibold text-success-text">
            {hu.revisions.appliedBadge}
          </span>
        ) : null}
      </header>

      {diff ? (
        <DiffPane
          originalLabel={hu.revisions.currentLabel}
          suggestionLabel={hu.revisions.revisionLabel}
          original={diff.original}
          suggestion={diff.suggestion}
        />
      ) : (
        <p className="whitespace-pre-wrap rounded-lg bg-surface-muted/50 p-2.5 text-[13px] text-text">
          {revision.content}
        </p>
      )}

      <div className="mt-2.5 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size={28}
          onClick={onReject}
          disabled={busy}
        >
          {hu.revisions.reject}
        </Button>
        <Button
          type="button"
          variant="accent-outline"
          size={28}
          onClick={onRestore}
          disabled={busy}
          leadingIcon={busy ? <Spinner size={12} /> : undefined}
        >
          {hu.revisions.restore}
        </Button>
      </div>
    </article>
  );
}
