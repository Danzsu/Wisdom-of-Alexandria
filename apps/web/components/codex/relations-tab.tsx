"use client";

/**
 * Kapcsolatok tab — the codex entry detail's relations list. Lists the entry's
 * relations in BOTH directions (rows where it is the source AND rows where it
 * is the target), showing the OTHER endpoint's resolved name + the relation
 * type + a direction hint. Delete is inline (toast on success/failure); create
 * reuses the graph screen's {@link NewRelationModal} with this entry
 * preselected as the from-entity — one modal, one copy set, one payload shape
 * across the app.
 */
import { useState } from "react";
import { ArrowLeft, ArrowRight, Trash2, Waypoints } from "lucide-react";
import { EmptyState, ErrorState, SkeletonList } from "@/components/kit";
import { Button } from "@/components/kit/button";
import { Icon } from "@/components/kit/icon";
import { toast } from "@/components/kit/toast";
import { NewRelationModal } from "@/components/relations/new-relation-modal";
import {
  useCodexEntries,
  useCodexRelations,
  useDeleteCodexRelation,
} from "@/lib/api/hooks";
import type { CodexEntryRead, CodexRelationRead } from "@/lib/api/types";
import { hu } from "@/lib/i18n/hu";

export interface RelationsTabProps {
  entry: CodexEntryRead;
  projectId: string;
}

export function RelationsTab({ entry, projectId }: RelationsTabProps) {
  const relations = useCodexRelations(projectId);
  const entries = useCodexEntries(projectId);
  const del = useDeleteCodexRelation();
  const [modalOpen, setModalOpen] = useState(false);

  if (relations.isError || entries.isError) {
    const error = relations.error ?? entries.error;
    return (
      <ErrorState
        message={hu.codexRelations.error}
        detail={error?.message ?? undefined}
        onRetry={() => {
          void relations.refetch();
          void entries.refetch();
        }}
      />
    );
  }
  if (relations.isLoading || entries.isLoading) {
    return <SkeletonList rows={3} />;
  }

  // Both directions: the entry as source OR as target.
  const mine = (relations.data ?? []).filter(
    (r) => r.from_entity_id === entry.id || r.to_entity_id === entry.id,
  );

  /** Resolve a codex entry id to its display name (muted fallback if gone). */
  function nameOf(id: string): string {
    return (
      (entries.data ?? []).find((e) => e.id === id)?.title ??
      hu.codexRelations.missingEntity
    );
  }

  function handleDelete(relation: CodexRelationRead) {
    del.mutate(
      { projectId, relationId: relation.id },
      {
        onSuccess: () => toast.success(hu.codexRelations.deletedToast),
        onError: (error) =>
          toast.error(`${hu.codexRelations.deleteError}: ${error.message}`),
      },
    );
  }

  const modal = (
    <NewRelationModal
      open={modalOpen}
      onOpenChange={setModalOpen}
      projectId={projectId}
      entries={entries.data ?? []}
      initialFromId={entry.id}
    />
  );

  if (mine.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Icon icon={Waypoints} size={22} />}
          title={hu.codexRelations.emptyTitle}
          description={hu.codexRelations.emptyHint}
          action={{
            label: hu.codexRelations.emptyCta,
            onClick: () => setModalOpen(true),
          }}
        />
        {modal}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button
          variant="accent-outline"
          size={32}
          onClick={() => setModalOpen(true)}
        >
          {hu.codexRelations.addNew}
        </Button>
      </div>

      <ul
        aria-label={hu.codexRelations.listAria}
        className="m-0 flex list-none flex-col gap-1.5 p-0"
      >
        {mine.map((relation) => {
          const outgoing = relation.from_entity_id === entry.id;
          const otherId = outgoing
            ? relation.to_entity_id
            : relation.from_entity_id;
          return (
            <li
              key={relation.id}
              className="flex items-center gap-3 rounded-[10px] border border-border bg-surface px-3.5 py-2.5"
            >
              <Icon
                icon={outgoing ? ArrowRight : ArrowLeft}
                size={14}
                className="flex-none text-text-faint"
              />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[13px] font-semibold text-text">
                  {nameOf(otherId)}
                </p>
                <p className="m-0 flex items-center gap-1.5 text-[12px] text-text-muted">
                  <span className="text-accent-text">
                    {relation.relation_type}
                  </span>
                  <span>
                    {outgoing
                      ? hu.codexRelations.directionOutgoing
                      : hu.codexRelations.directionIncoming}
                  </span>
                </p>
                {relation.description ? (
                  <p className="m-0 mt-0.5 truncate text-[12px] text-text-soft">
                    {relation.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={hu.codexRelations.deleteAria(
                  relation.relation_type,
                )}
                onClick={() => handleDelete(relation)}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:border-danger hover:bg-danger-muted hover:text-danger-text"
              >
                <Icon icon={Trash2} size={13} />
              </button>
            </li>
          );
        })}
      </ul>

      {modal}
    </div>
  );
}
