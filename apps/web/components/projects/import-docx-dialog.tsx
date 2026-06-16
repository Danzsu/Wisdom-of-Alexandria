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
import { FileUp } from "lucide-react";
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
            <FieldLabel>{hu.importDialog.fileLabel}</FieldLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-label={hu.importDialog.fileLabel}
              onChange={handleFileChange}
              className="block w-full text-[13px] text-text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-text hover:file:border-accent"
            />
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
