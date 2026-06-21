"use client";

/**
 * Create / edit-plotline modal (Plotline-b). Captures a title, a plotline type,
 * a status, an optional description and an optional book scope (project-wide or
 * pinned to the active book), then POSTs a `PlotlineCreate` or PATCHes a
 * `PlotlineUpdate`. The type/status/scope pickers are styled native `<select>`s
 * — calm, keyboard- and screen-reader-friendly, no extra dep.
 *
 * Validation is local (title required); the mutation error is surfaced inline
 * AND as a toast — never swallowed.
 */
import { useEffect, useState } from "react";
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
import { useCreatePlotline, useUpdatePlotline } from "@/lib/api/hooks";
import {
  PLOTLINE_TYPES,
  PLOTLINE_STATUSES,
  type PlotlineRead,
  type PlotlineType,
  type PlotlineStatus,
} from "@/lib/api/types";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

export interface PlotlineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** The active book — offered as an optional scope; null = project-wide. */
  bookId: string | undefined;
  /** When set, the modal edits this plotline; otherwise it creates a new one. */
  plotline?: PlotlineRead | null;
}

const SELECT_CLASS = cn(
  "box-border h-9 w-full rounded-lg border border-border bg-surface px-3 font-sans text-[14px] text-text outline-none",
  "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/** Scope select values (kept distinct from a book id so "" is unambiguous). */
const SCOPE_PROJECT = "__project__";
const SCOPE_BOOK = "__book__";

export function PlotlineModal({
  open,
  onOpenChange,
  projectId,
  bookId,
  plotline,
}: PlotlineModalProps) {
  const isEdit = Boolean(plotline);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PlotlineType>("subplot");
  const [status, setStatus] = useState<PlotlineStatus>("planning");
  const [description, setDescription] = useState("");
  // Scope: project-wide or pinned to the active book.
  const [scope, setScope] = useState<typeof SCOPE_PROJECT | typeof SCOPE_BOOK>(
    SCOPE_PROJECT,
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createPlotline = useCreatePlotline();
  const updatePlotline = useUpdatePlotline();
  const isPending = createPlotline.isPending || updatePlotline.isPending;

  // Hydrate the form from the edited plotline (or reset to defaults) whenever
  // the modal opens or its target changes.
  useEffect(() => {
    if (!open) return;
    setFieldError(null);
    setSubmitError(null);
    if (plotline) {
      setTitle(plotline.title);
      setType((plotline.plotline_type as PlotlineType) ?? "subplot");
      setStatus((plotline.status as PlotlineStatus) ?? "planning");
      setDescription(plotline.description ?? "");
      setScope(plotline.book_id ? SCOPE_BOOK : SCOPE_PROJECT);
    } else {
      setTitle("");
      setType("subplot");
      setStatus("planning");
      setDescription("");
      setScope(SCOPE_PROJECT);
    }
  }, [open, plotline]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  function handleSubmit() {
    setFieldError(null);
    setSubmitError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setFieldError(hu.plotlines.modalTitleRequired);
      return;
    }
    const desc = description.trim() ? description.trim() : null;
    // Book scope is only offered when a book is in context.
    const bookScope = scope === SCOPE_BOOK && bookId ? bookId : null;

    if (isEdit && plotline) {
      updatePlotline.mutate(
        {
          projectId,
          plotlineId: plotline.id,
          patch: {
            title: trimmed,
            plotline_type: type,
            status,
            description: desc,
            book_id: bookScope,
          },
        },
        {
          onSuccess: () => {
            toast.success(hu.plotlines.updatedToast);
            handleOpenChange(false);
          },
          onError: (error) => {
            setSubmitError(error.message);
            toast.error(hu.plotlines.updateError);
          },
        },
      );
      return;
    }

    createPlotline.mutate(
      {
        projectId,
        data: {
          title: trimmed,
          plotline_type: type,
          status,
          description: desc,
          book_id: bookScope,
          order_index: 0,
        },
      },
      {
        onSuccess: () => {
          toast.success(hu.plotlines.createdToast);
          handleOpenChange(false);
        },
        onError: (error) => {
          setSubmitError(error.message);
          toast.error(hu.plotlines.createError);
        },
      },
    );
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={480}>
        <ModalHeader
          title={
            isEdit ? hu.plotlines.modalEditTitle : hu.plotlines.modalCreateTitle
          }
        />
        <ModalBody>
          <div className="flex flex-col gap-3.5">
            <div>
              <FieldLabel htmlFor="plotline-title">
                {hu.plotlines.modalTitleLabel}
              </FieldLabel>
              <FormInput
                id="plotline-title"
                placeholder={hu.plotlines.modalTitlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
              />
            </div>

            <div>
              <FieldLabel htmlFor="plotline-type">
                {hu.plotlines.modalTypeLabel}
              </FieldLabel>
              <select
                id="plotline-type"
                className={SELECT_CLASS}
                value={type}
                onChange={(e) => setType(e.target.value as PlotlineType)}
              >
                {PLOTLINE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {hu.plotlines.type[t] ?? t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="plotline-status">
                {hu.plotlines.modalStatusLabel}
              </FieldLabel>
              <select
                id="plotline-status"
                className={SELECT_CLASS}
                value={status}
                onChange={(e) => setStatus(e.target.value as PlotlineStatus)}
              >
                {PLOTLINE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {hu.plotlines.status[s] ?? s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="plotline-scope">
                {hu.plotlines.modalBookScopeLabel}
              </FieldLabel>
              <select
                id="plotline-scope"
                className={SELECT_CLASS}
                value={scope}
                disabled={!bookId}
                onChange={(e) =>
                  setScope(
                    e.target.value === SCOPE_BOOK ? SCOPE_BOOK : SCOPE_PROJECT,
                  )
                }
              >
                <option value={SCOPE_PROJECT}>
                  {hu.plotlines.modalBookScopeProject}
                </option>
                {bookId ? (
                  <option value={SCOPE_BOOK}>
                    {hu.plotlines.bookScopeLabel}
                  </option>
                ) : null}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="plotline-desc">
                {hu.plotlines.modalDescriptionLabel}
              </FieldLabel>
              <Textarea
                id="plotline-desc"
                placeholder={hu.plotlines.modalDescriptionPlaceholder}
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
                {(isEdit
                  ? hu.plotlines.updateError
                  : hu.plotlines.createError)}
                : {submitError}
              </p>
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            {hu.plotlines.modalCancel}
          </Button>
          <Button variant="cta" disabled={isPending} onClick={handleSubmit}>
            {isEdit ? hu.plotlines.modalSave : hu.plotlines.modalCreate}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}
