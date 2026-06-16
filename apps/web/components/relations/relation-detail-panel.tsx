"use client";

/**
 * Side detail panel for a selected graph node (UX-3a). Lists the node's
 * relations (direction + label + the other endpoint) and links to open the
 * underlying codex entry. This panel is ALSO the non-visual fallback for the
 * SVG: a keyboard/screen-reader user reads a node's connections here in plain
 * text. Delete is offered per relation, with the mutation error surfaced.
 */
import Link from "next/link";
import { ArrowRight, ExternalLink, Trash2, X } from "lucide-react";
import { IconButton } from "@/components/kit";
import { Avatar } from "@/components/kit/avatar";
import { useDeleteCodexRelation } from "@/lib/api/hooks";
import { toast } from "@/components/kit/toast";
import type { CodexEntryRead, CodexRelationRead } from "@/lib/api/types";
import { relationsForNode, MISSING_NODE_LABEL } from "./graph-data";
import { hu } from "@/lib/i18n/hu";

export interface RelationDetailPanelProps {
  projectId: string;
  bookId: string | undefined;
  nodeId: string;
  entries: readonly CodexEntryRead[];
  relations: readonly CodexRelationRead[];
  onClose: () => void;
}

/** Resolve an entity id to its codex title, or the muted fallback. */
function labelFor(
  id: string,
  entries: readonly CodexEntryRead[],
): { label: string; missing: boolean } {
  const entry = entries.find((e) => e.id === id);
  return entry
    ? { label: entry.title, missing: false }
    : { label: MISSING_NODE_LABEL, missing: true };
}

export function RelationDetailPanel({
  projectId,
  bookId,
  nodeId,
  entries,
  relations,
  onClose,
}: RelationDetailPanelProps) {
  const deleteRelation = useDeleteCodexRelation();
  const node = labelFor(nodeId, entries);
  const incident = relationsForNode(nodeId, relations);

  function handleDelete(relationId: string) {
    deleteRelation.mutate(
      { projectId, relationId },
      {
        onSuccess: () => toast.success(hu.relations.deleted),
        // Surface the failure — never swallow it.
        onError: () => toast.error(hu.relations.deleteError),
      },
    );
  }

  return (
    <aside className="flex w-[300px] flex-none flex-col gap-3 border-l border-border bg-surface px-4 py-4">
      <header className="flex items-start gap-2.5">
        <Avatar
          name={node.missing ? undefined : node.label}
          color={node.missing ? "accent" : undefined}
          size={38}
          variant="graph"
        />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate font-serif text-[16px] font-semibold text-text">
            {node.label}
          </h2>
          {node.missing ? (
            <p className="m-0 text-[12px] text-text-muted">
              {hu.relations.missingHint}
            </p>
          ) : bookId ? (
            <Link
              href={`/konyv/${bookId}/codex?entry=${encodeURIComponent(nodeId)}`}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-text hover:underline"
            >
              <ExternalLink size={12} aria-hidden />
              {hu.relations.detailOpenCodex}
            </Link>
          ) : null}
        </div>
        <IconButton
          aria-label={hu.relations.closePanelAria}
          size={28}
          onClick={onClose}
        >
          <X size={16} aria-hidden />
        </IconButton>
      </header>

      <section className="flex flex-col gap-1.5">
        <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
          {hu.relations.detailRelationsHeading}
        </h3>
        {incident.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">
            {hu.relations.detailNoRelations}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {incident.map((relation) => {
              const outgoing = relation.from_entity_id === nodeId;
              const otherId = outgoing
                ? relation.to_entity_id
                : relation.from_entity_id;
              const other = labelFor(otherId, entries);
              return (
                <li
                  key={relation.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] font-medium text-text">
                      {relation.relation_type}
                    </p>
                    <p className="m-0 flex items-center gap-1 text-[12px] text-text-muted">
                      <span className="text-text-faint">
                        {outgoing
                          ? hu.relations.detailDirectionTo
                          : hu.relations.detailDirectionFrom}
                      </span>
                      <ArrowRight size={11} aria-hidden />
                      <span className="truncate">{other.label}</span>
                    </p>
                  </div>
                  <IconButton
                    aria-label={hu.relations.deleteRelationAria}
                    size={28}
                    disabled={deleteRelation.isPending}
                    onClick={() => handleDelete(relation.id)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
