"use client";

/**
 * Restore-backup dialog (Feature #5) — pick a `.json` backup, then restore it
 * into a BRAND-NEW project (the existing projects are untouched). On success it
 * surfaces a toast with the restored project's title and closes; the projects
 * list is invalidated by {@link useRestoreBackup} so the copy appears.
 *
 * States: a disabled submit until a `.json` file is chosen; a pending spinner
 * while the restore runs; an inline error that surfaces the server's detail
 * verbatim (the 400/413/422 reason) — never swallowed.
 */
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import {
  Button,
  FieldLabel,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  toast,
} from "@/components/kit";
import { useRestoreBackup } from "@/lib/api/hooks";
import { hu } from "@/lib/i18n/hu";

const JSON_EXT = ".json";

export interface RestoreBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestoreBackupDialog({
  open,
  onOpenChange,
}: RestoreBackupDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restore = useRestoreBackup();

  function reset() {
    setFile(null);
    setSubmitError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSubmitError(null);
    const picked = event.target.files?.[0] ?? null;
    if (picked && !picked.name.toLowerCase().endsWith(JSON_EXT)) {
      setFile(null);
      setSubmitError(hu.backup.wrongTypeError);
      return;
    }
    setFile(picked);
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!file) {
      setSubmitError(hu.backup.noFileError);
      return;
    }

    try {
      const summary = await restore.mutateAsync(file);
      toast.success(hu.backup.restoreSuccess(summary.title));
      handleOpenChange(false);
    } catch (error) {
      // ApiError (and any Error) carries a message — surface it, never swallow.
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(message);
      toast.error(hu.backup.restoreError);
    }
  }

  const pending = restore.isPending;

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={480} description={hu.backup.restoreDescription}>
        <ModalHeader
          title={hu.backup.restoreTitle}
          leadingIcon={<Upload size={17} />}
        />
        <ModalBody>
          <p className="mb-4 text-[13px] leading-[1.5] text-text-muted">
            {hu.backup.restoreDescription}
          </p>

          <div>
            <FieldLabel>{hu.backup.fileLabel}</FieldLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              aria-label={hu.backup.fileLabel}
              onChange={handleFileChange}
              className="block w-full text-[13px] text-text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-text hover:file:border-accent"
            />
          </div>

          {submitError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-danger border-l-[3px] bg-surface px-3.5 py-3 text-[12px] text-danger-text"
            >
              {hu.backup.restoreError}: {submitError}
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            size={34}
            onClick={() => handleOpenChange(false)}
          >
            {hu.backup.cancel}
          </Button>
          <div className="flex-1" />
          <Button
            variant="cta"
            size={34}
            disabled={pending || !file}
            leadingIcon={<Upload size={14} />}
            onClick={handleSubmit}
          >
            {pending ? hu.backup.restoring : hu.backup.submit}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}
