"use client";

import { useState } from "react";
import { Info, Plus } from "lucide-react";
import { Button } from "@/components/kit/button";
import { ConfirmDialog } from "@/components/kit/alert-dialog";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useDeleteProvider, useProviders } from "@/lib/api/providers-hooks";
import type { ProviderRead } from "@/lib/api/providers";
import { SettingsSubpageHeader } from "./settings-subpage-header";
import { ProviderCard } from "./provider-card";
import { ProviderFormModal } from "./provider-form-modal";

export interface CloudSubpageProps {
  onBack: () => void;
}

/**
 * Cloud provider subpage (P1.1 — REAL provider/API-key configuration).
 *
 * Lists the configured providers from `GET /providers`, each as a card showing
 * its masked key state (never the real key), an enabled toggle, a connection
 * test and a model count. "+ Provider hozzáadása" opens the add/edit modal;
 * each card can be edited or deleted (with a confirm). Loading / empty / error
 * states are handled; errors are surfaced (never swallowed).
 */
export function CloudSubpage({ onBack }: Readonly<CloudSubpageProps>) {
  const providersQuery = useProviders();
  const deleteProvider = useDeleteProvider();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRead | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProviderRead | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(provider: ProviderRead) {
    setEditing(provider);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    deleteProvider.mutate(target.id, {
      onSuccess: () => {
        toast.success(hu.settings.cloudDeletedToast);
        setPendingDelete(null);
      },
      onError: (error) => {
        toast.error(`${hu.settings.cloudDeleteError}: ${error.message}`);
        setPendingDelete(null);
      },
    });
  }

  const providers = providersQuery.data ?? [];

  return (
    <div>
      <SettingsSubpageHeader
        title={hu.settings.cloudTitle}
        subtitle={hu.settings.cloudSubtitle}
        onBack={onBack}
      />

      <div className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-border border-l-[3px] border-l-ai bg-surface px-3.5 py-3">
        <Info size={15} className="mt-px flex-none text-ai" aria-hidden="true" />
        <p className="text-[12px] leading-relaxed text-text-soft">
          {hu.settings.cloudNote}
        </p>
      </div>

      {providersQuery.isLoading ? (
        <div className="flex items-center gap-2 py-3 text-[13px] text-text-muted">
          <Spinner size={15} />
          {hu.settings.cloudLoading}
        </div>
      ) : providersQuery.isError ? (
        <div className="py-3 text-[13px] text-danger-text" role="alert">
          {hu.settings.cloudError}
          {providersQuery.error ? (
            <span className="mt-1 block text-[12px] text-text-muted">
              {providersQuery.error.message}
            </span>
          ) : null}
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
          <p className="text-[13px] font-medium text-text">
            {hu.settings.cloudEmpty}
          </p>
          <p className="mx-auto mt-1 max-w-[340px] text-[12px] text-text-muted">
            {hu.settings.cloudEmptyHint}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      <Button
        variant="dashed"
        size={34}
        className="mt-3 font-semibold text-accent-text"
        onClick={openAdd}
      >
        <Plus size={13} aria-hidden="true" />
        {hu.settings.cloudAddProvider}
      </Button>

      {/* Remount per add/edit session so RHF re-reads fresh defaultValues
          (and the api-key field re-blanks) without a reset effect. */}
      <ProviderFormModal
        key={`${formOpen ? "open" : "closed"}-${editing?.id ?? "new"}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={hu.settings.cloudDeleteConfirmTitle}
        description={
          pendingDelete
            ? hu.settings.cloudDeleteConfirmBody(pendingDelete.label)
            : ""
        }
        confirmLabel={hu.settings.cloudDeleteButton}
        cancelLabel={hu.settings.cloudModalCancel}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
