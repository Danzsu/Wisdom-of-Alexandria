"use client";

/**
 * Create-relation modal (UX-3a). Picks a from-entity + a to-entity from the
 * project's codex entries, a free-text `relation_type` and an optional
 * description, then POSTs a `CodexRelationCreate`. The entity pickers are styled
 * native `<select>`s — calm, keyboard- and screen-reader-friendly, no extra dep.
 *
 * Validation is local (both endpoints required, no self-loop, type required);
 * the mutation error is surfaced inline AND as a toast — never swallowed.
 */
import { useState } from "react";
import {
  Modal,
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormInput,
  Textarea,
  FieldLabel,
  toast,
} from "@/components/kit";
import { useCreateCodexRelation } from "@/lib/api/hooks";
import type { CodexEntryRead } from "@/lib/api/types";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

export interface NewRelationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | undefined;
  /** The project's codex entries — the node corpus the pickers choose from. */
  entries: readonly CodexEntryRead[];
  /** Optional id to preselect as the from-entity (graph "add from here"). */
  initialFromId?: string;
  onCreated?: (relationId: string) => void;
}

const SELECT_CLASS = cn(
  "box-border h-9 w-full rounded-lg border border-border bg-surface px-3 font-sans text-[14px] text-text outline-none",
  "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function NewRelationModal({
  open,
  onOpenChange,
  projectId,
  entries,
  initialFromId,
  onCreated,
}: NewRelationModalProps) {
  const [fromId, setFromId] = useState(initialFromId ?? "");
  const [toId, setToId] = useState("");
  const [relationType, setRelationType] = useState("");
  const [description, setDescription] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createRelation = useCreateCodexRelation();

  const noEntries = entries.length < 2;

  function reset() {
    setFromId(initialFromId ?? "");
    setToId("");
    setRelationType("");
    setDescription("");
    setFieldError(null);
    setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  /** Resolve the polymorphic entity type for a picked id (defaults to codex). */
  function typeOf(id: string): string {
    return entries.find((e) => e.id === id)?.entry_type ?? "codex";
  }

  function handleCreate() {
    setFieldError(null);
    setSubmitError(null);
    if (!projectId) return;
    if (!fromId) {
      setFieldError(hu.relations.modalFromRequired);
      return;
    }
    if (!toId) {
      setFieldError(hu.relations.modalToRequired);
      return;
    }
    if (fromId === toId) {
      setFieldError(hu.relations.modalSameError);
      return;
    }
    const label = relationType.trim();
    if (!label) {
      setFieldError(hu.relations.modalTypeRequired);
      return;
    }
    createRelation.mutate(
      {
        projectId,
        data: {
          from_entity_type: typeOf(fromId),
          from_entity_id: fromId,
          to_entity_type: typeOf(toId),
          to_entity_id: toId,
          relation_type: label,
          description: description.trim() ? description.trim() : null,
        },
      },
      {
        onSuccess: (created) => {
          toast.success(hu.relations.createdToast);
          handleOpenChange(false);
          onCreated?.(created.id);
        },
        onError: (error) => {
          // Surface the failure inline + toast; never swallow it.
          setSubmitError(error.message);
          toast.error(hu.relations.createError);
        },
      },
    );
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={480}>
        <ModalHeader title={hu.relations.modalTitle} />
        <ModalBody>
          {noEntries ? (
            <p className="m-0 text-[13px] leading-[1.5] text-text-muted">
              {hu.relations.modalNoEntries}
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              <div>
                <FieldLabel htmlFor="rel-from">
                  {hu.relations.modalFromLabel}
                </FieldLabel>
                <select
                  id="rel-from"
                  className={SELECT_CLASS}
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  <option value="">{hu.relations.modalFromPlaceholder}</option>
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="rel-to">
                  {hu.relations.modalToLabel}
                </FieldLabel>
                <select
                  id="rel-to"
                  className={SELECT_CLASS}
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                >
                  <option value="">{hu.relations.modalToPlaceholder}</option>
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="rel-type">
                  {hu.relations.modalTypeLabel}
                </FieldLabel>
                <FormInput
                  id="rel-type"
                  placeholder={hu.relations.modalTypePlaceholder}
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div>
                <FieldLabel htmlFor="rel-desc">
                  {hu.relations.modalDescriptionLabel}
                </FieldLabel>
                <Textarea
                  id="rel-desc"
                  placeholder={hu.relations.modalDescriptionPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {fieldError ? (
                <p role="alert" className="m-0 text-[12px] text-danger-text">
                  {fieldError}
                </p>
              ) : null}
              {submitError ? (
                <p role="alert" className="m-0 text-[12px] text-danger-text">
                  {hu.relations.createError}: {submitError}
                </p>
              ) : null}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            {hu.relations.modalCancel}
          </Button>
          <Button
            variant="cta"
            disabled={noEntries || createRelation.isPending}
            onClick={handleCreate}
          >
            {hu.relations.modalCreate}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}
