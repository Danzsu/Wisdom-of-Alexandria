"use client";

/**
 * Import-DOCX dialog (Feature #2b) — pick a `.docx`, optionally name the book,
 * then upload. The import endpoint creates the book under an EXISTING project,
 * so this dialog first creates a project (mirroring the New-book wizard's
 * project↔book contract) then imports the file into it. On success it navigates
 * to the new book's plan view.
 *
 * States: a disabled submit until a file is chosen; a pending spinner while the
 * upload runs; an inline error that surfaces the server's detail verbatim (the
 * 400/413/502/503 reason) — never swallowed.
 */
import { useRef, useState } from "react";
import { Check, FileText, FileUp } from "lucide-react";
import {
  Button,
  FieldLabel,
  FormInput,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  toast,
} from "@/components/kit";
import { useImportDocx } from "@/lib/api/hooks";
import { createProject } from "@/lib/api/projects";
import { useNavTo } from "@/lib/use-nav-to";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";

const DOCX_EXT = ".docx";

export interface ImportDocxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDocxDialog({ open, onOpenChange }: ImportDocxDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navTo = useNavTo();
  const importDocx = useImportDocx();

  function reset() {
    setFile(null);
    setTitle("");
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
    if (picked && !picked.name.toLowerCase().endsWith(DOCX_EXT)) {
      setFile(null);
      setSubmitError(hu.importDialog.wrongTypeError);
      return;
    }
    setFile(picked);
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!file) {
      setSubmitError(hu.importDialog.noFileError);
      return;
    }

    try {
      // The import endpoint targets an existing project; create one first so the
      // imported book has a home (faithful to the project↔book contract).
      const trimmedTitle = title.trim();
      const project = await createProject({
        title: trimmedTitle || file.name.replace(/\.docx$/i, ""),
        language: "hu",
      });
      const summary = await importDocx.mutateAsync({
        projectId: project.id,
        file,
        title: trimmedTitle || undefined,
      });
      toast.success(
        hu.importDialog.successToast(
          summary.chapter_count,
          summary.scene_count,
        ),
      );
      handleOpenChange(false);
      navTo(routes.book(summary.book_id, "terv"));
    } catch (error) {
      // ApiError (and any Error) carries a message — surface it, never swallow.
      const message =
        error instanceof Error ? error.message : String(error);
      setSubmitError(message);
      toast.error(hu.importDialog.errorTitle);
    }
  }

  const pending = importDocx.isPending;

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={480} description={hu.importDialog.description}>
        <ModalHeader
          title={hu.importDialog.title}
          leadingIcon={<FileUp size={17} />}
        />
        <ModalBody>
          <p className="mb-4 text-[13px] leading-[1.5] text-text-muted">
            {hu.importDialog.description}
          </p>

          <div className="mb-3.5">
            {file ? (
              /* File-info card: chosen file + a "selected" badge. The same hidden
                 input stays mounted so re-selecting (and the fileLabel a11y hook)
                 keep working. */
              <div className="flex items-center gap-3 rounded-[13px] border border-border bg-surface-soft px-4 py-3.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  aria-label={hu.importDialog.fileLabel}
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[10px] bg-accent-muted text-accent-strong">
                  <FileText size={20} strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-text">
                    {file.name}
                  </span>
                  <span className="block text-[11.5px] text-text-muted">
                    {hu.importDialog.fileLabel}
                  </span>
                </span>
                <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-success-muted px-2.5 py-0.5 text-[11px] font-semibold text-success-text">
                  <Check size={12} strokeWidth={2.2} />
                  {hu.importDialog.fileReadyBadge}
                </span>
              </div>
            ) : (
              /* Drag-drop upload zone: dashed border, gold hover, hidden input. */
              <label className="group relative flex cursor-pointer flex-col items-center justify-center gap-3.5 rounded-[16px] border-2 border-dashed border-border-strong bg-surface-soft px-6 py-11 text-center transition-[border-color,background-color] duration-150 hover:border-gold hover:bg-gold-soft motion-reduce:transition-none">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  aria-label={hu.importDialog.fileLabel}
                  onChange={handleFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full border border-border bg-surface text-gold-text shadow-card">
                  <FileUp size={26} strokeWidth={1.6} />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold text-text">
                    {hu.importDialog.dropzoneCta}
                  </span>
                  <span className="text-[12.5px] text-text-muted">
                    {hu.importDialog.dropzoneHint}
                  </span>
                </span>
                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">
                  {hu.importDialog.acceptedFormat}
                </span>
              </label>
            )}
          </div>

          <div>
            <FieldLabel htmlFor="import-title">
              {hu.importDialog.titleLabel}
            </FieldLabel>
            <FormInput
              id="import-title"
              value={title}
              placeholder={hu.importDialog.titlePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {submitError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-danger border-l-[3px] bg-surface px-3.5 py-3 text-[12px] text-danger-text"
            >
              {hu.importDialog.errorTitle}: {submitError}
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            size={34}
            onClick={() => handleOpenChange(false)}
          >
            {hu.importDialog.cancel}
          </Button>
          <div className="flex-1" />
          <Button
            variant="cta"
            size={34}
            disabled={pending || !file}
            leadingIcon={<FileUp size={14} />}
            onClick={handleSubmit}
          >
            {pending ? hu.importDialog.importing : hu.importDialog.submit}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}
