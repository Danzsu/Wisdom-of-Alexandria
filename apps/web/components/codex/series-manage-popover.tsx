"use client";

/**
 * Series management popover (Feature #3c) — a compact, functional control that
 * lives next to the Codex scope-toggle. It lets the user, within a project:
 *   - create a new series,
 *   - rename / delete an existing series,
 *   - assign the CURRENT book to a series (or clear it).
 *
 * It deliberately is NOT a sprawling screen — just the minimal real UX that fits
 * the existing Codex IA. Every mutation surfaces its error (incl. the backend's
 * 400 for a cross-project series assignment) via a toast / inline alert and is
 * never swallowed.
 */
import { useState } from "react";
import { Library, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Icon,
  Popover,
  PopoverPanel,
  PopoverTrigger,
  Spinner,
  toast,
} from "@/components/kit";
import { ConfirmDialog } from "@/components/kit/alert-dialog";
import {
  useCreateSeries,
  useDeleteSeries,
  useSeries,
  useUpdateSeries,
} from "@/lib/api/series-hooks";
import { useUpdateBook } from "@/lib/api/hooks";
import type { BookRead, SeriesRead } from "@/lib/api/types";
import { hu } from "@/lib/i18n/hu";

export interface SeriesManagePopoverProps {
  projectId: string | undefined;
  /** The active book (resolved from the route) — gets a series assignment UI. */
  book: BookRead | undefined;
}

export function SeriesManagePopover({
  projectId,
  book,
}: SeriesManagePopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={hu.codex.seriesManageAria}
          title={hu.codex.seriesManageAria}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-border bg-surface text-text-muted hover:border-accent hover:bg-accent-muted hover:text-accent-text"
        >
          <Icon icon={Library} size={13} />
        </button>
      </PopoverTrigger>
      <PopoverPanel align="end" className="w-[300px]">
        <SeriesManageBody projectId={projectId} book={book} />
      </PopoverPanel>
    </Popover>
  );
}

function SeriesManageBody({
  projectId,
  book,
}: {
  projectId: string | undefined;
  book: BookRead | undefined;
}) {
  const series = useSeries(projectId);
  const createSeries = useCreateSeries();
  const [newName, setNewName] = useState("");

  function handleCreate() {
    const title = newName.trim();
    if (!projectId || !title) return;
    createSeries.mutate(
      { projectId, data: { title } },
      {
        onSuccess: () => {
          toast.success(hu.codex.seriesCreatedToast);
          setNewName("");
        },
        onError: (error) =>
          toast.error(`${hu.codex.seriesCreateError}: ${error.message}`),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="m-0 text-[13px] font-semibold text-text">
          {hu.codex.seriesManageTitle}
        </p>
        <p className="m-0 mt-1 text-[11px] leading-[1.5] text-text-muted">
          {hu.codex.seriesManageHint}
        </p>
      </div>

      {/* Assign the current book to a series. */}
      {book && projectId ? (
        <BookSeriesAssign
          projectId={projectId}
          book={book}
          series={series.data ?? []}
        />
      ) : null}

      {/* Series list (rename / delete). */}
      <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
        {series.isError ? (
          <p role="alert" className="m-0 text-[12px] text-danger-text">
            {series.error?.message ?? hu.codex.seriesLoadError}
          </p>
        ) : series.isLoading ? (
          <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
            <Spinner size={12} />
            {hu.codex.seriesScopeLoading}
          </div>
        ) : (series.data ?? []).length === 0 ? (
          <p className="m-0 text-[12px] text-text-muted">
            {hu.codex.seriesEmptyManage}
          </p>
        ) : (
          (series.data ?? []).map((s) => (
            <SeriesRow key={s.id} projectId={projectId as string} series={s} />
          ))
        )}
      </div>

      {/* Create a new series. */}
      <div className="flex items-center gap-1.5 border-t border-border pt-2.5">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder={hu.codex.seriesNamePlaceholder}
          aria-label={hu.codex.seriesNewLabel}
          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-text outline-none placeholder:text-text-faint focus-visible:border-accent"
        />
        <Button
          variant="cta"
          size={32}
          disabled={createSeries.isPending || newName.trim().length === 0}
          onClick={handleCreate}
        >
          <Icon icon={Plus} size={13} />
          {hu.codex.seriesCreate}
        </Button>
      </div>
    </div>
  );
}

/** A single series row: name + rename / delete. */
function SeriesRow({
  projectId,
  series,
}: {
  projectId: string;
  series: SeriesRead;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(series.title);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = useUpdateSeries();
  const del = useDeleteSeries();

  function commitRename() {
    const next = name.trim();
    if (!next || next === series.title) {
      setEditing(false);
      setName(series.title);
      return;
    }
    update.mutate(
      { projectId, seriesId: series.id, patch: { title: next } },
      {
        onSuccess: () => {
          toast.success(hu.codex.seriesRenamedToast);
          setEditing(false);
        },
        onError: (error) =>
          toast.error(`${hu.codex.seriesRenameError}: ${error.message}`),
      },
    );
  }

  function handleDelete() {
    del.mutate(
      { projectId, seriesId: series.id },
      {
        onSuccess: () => toast.success(hu.codex.seriesDeletedToast),
        onError: (error) =>
          toast.error(`${hu.codex.seriesDeleteError}: ${error.message}`),
      },
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setEditing(false);
              setName(series.title);
            }
          }}
          aria-label={hu.codex.seriesRenameAria(series.title)}
          className="h-7 min-w-0 flex-1 rounded-lg border border-accent bg-surface px-2 text-[13px] text-text outline-none"
        />
        <Button
          variant="cta"
          size={28}
          disabled={update.isPending}
          onClick={commitRename}
        >
          {hu.codex.seriesSave}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-text">
        <Icon icon={Library} size={12} className="flex-none text-text-muted" />
        <span className="truncate">{series.title}</span>
      </span>
      <button
        type="button"
        aria-label={hu.codex.seriesRenameAria(series.title)}
        onClick={() => {
          setName(series.title);
          setEditing(true);
        }}
        className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <Icon icon={Pencil} size={12} />
      </button>
      <button
        type="button"
        aria-label={hu.codex.seriesDeleteAria(series.title)}
        onClick={() => setConfirmOpen(true)}
        className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-text-muted hover:bg-danger-muted hover:text-danger-text"
      >
        <Icon icon={Trash2} size={12} />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={hu.codex.seriesDeleteConfirmTitle}
        description={hu.codex.seriesDeleteConfirmDescription(series.title)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/** Assign / clear the current book's series. */
function BookSeriesAssign({
  projectId,
  book,
  series,
}: {
  projectId: string;
  book: BookRead;
  series: SeriesRead[];
}) {
  const update = useUpdateBook();

  function handleChange(value: string) {
    const seriesId = value === "" ? null : value;
    if (seriesId === (book.series_id ?? null)) return;
    update.mutate(
      { projectId, bookId: book.id, patch: { series_id: seriesId } },
      {
        onSuccess: () => toast.success(hu.codex.bookSeriesSavedToast),
        // Surfaces the backend's 400 for a cross-project series (never swallowed).
        onError: (error) =>
          toast.error(`${hu.codex.bookSeriesSaveError}: ${error.message}`),
      },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="book-series-select"
        className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted"
      >
        {hu.codex.bookSeriesLabel}
      </label>
      <div className="flex items-center gap-1.5">
        <select
          id="book-series-select"
          aria-label={hu.codex.bookSeriesAssignAria}
          value={book.series_id ?? ""}
          disabled={update.isPending}
          onChange={(e) => handleChange(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-[13px] text-text outline-none focus-visible:border-accent"
        >
          <option value="">{hu.codex.bookSeriesNone}</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {book.series_id ? (
          <button
            type="button"
            aria-label={hu.codex.bookSeriesNone}
            disabled={update.isPending}
            onClick={() => handleChange("")}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <Icon icon={X} size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
