"use client";

/**
 * "Új sorozat" modal (gap-fix #3) — a minimal name-only create dialog opened
 * from the codex-entry scope picker (CodexDetail → Hatókör), so a series can be
 * created right where it is needed instead of hunting for the sidebar's manage
 * popover. POSTs via {@link useCreateSeries} (project-scoped); the hook
 * invalidates the project's series list on success so every picker (this scope
 * select, the sidebar scope toggle, the manage popover) refreshes. Errors are
 * surfaced via toast + inline alert and the modal stays open (input not lost).
 */
import { useState } from "react";
import { Library } from "lucide-react";
import { Button } from "@/components/kit/button";
import { FieldLabel } from "@/components/kit/form-input";
import { Icon } from "@/components/kit/icon";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from "@/components/kit/modal-shell";
import { toast } from "@/components/kit/toast";
import { useCreateSeries } from "@/lib/api/series-hooks";
import { hu } from "@/lib/i18n/hu";

export interface NewSeriesModalProps {
  /** The owning project (series are project-scoped). */
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSeriesModal({
  projectId,
  open,
  onOpenChange,
}: Readonly<NewSeriesModalProps>) {
  const create = useCreateSeries();
  const [name, setName] = useState("");

  const title = name.trim();
  const canCreate = title.length > 0 && !create.isPending;

  function handleOpenChange(next: boolean) {
    if (!next) setName("");
    onOpenChange(next);
  }

  function handleCreate() {
    if (!canCreate) return;
    create.mutate(
      { projectId, data: { title } },
      {
        onSuccess: () => {
          toast.success(hu.codex.seriesCreatedToast);
          setName("");
          onOpenChange(false);
        },
        // Surfaced (toast + the inline alert below) — never swallowed; the
        // modal stays open so the typed name is not lost.
        onError: (error) =>
          toast.error(`${hu.codex.seriesCreateError}: ${error.message}`),
      },
    );
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={380} description={hu.codex.seriesManageHint}>
        <ModalHeader
          title={hu.codex.seriesNewLabel}
          leadingIcon={
            <Icon icon={Library} size={16} className="text-accent" />
          }
        />
        <ModalBody>
          <FieldLabel htmlFor="new-series-name">
            {hu.codex.seriesNameLabel}
          </FieldLabel>
          <input
            id="new-series-name"
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder={hu.codex.seriesNamePlaceholder}
            className="box-border h-9 w-full rounded-[10px] border border-border bg-surface px-3 text-[13px] text-text outline-none placeholder:text-text-faint focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]"
          />
          {create.isError ? (
            <p role="alert" className="m-0 mt-2 text-[12px] text-danger-text">
              {hu.codex.seriesCreateError}: {create.error?.message}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            size={32}
            onClick={() => handleOpenChange(false)}
          >
            {hu.codex.seriesCancel}
          </Button>
          <Button
            type="button"
            variant="cta"
            size={32}
            disabled={!canCreate}
            loading={create.isPending}
            onClick={handleCreate}
          >
            {hu.codex.seriesCreate}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}
