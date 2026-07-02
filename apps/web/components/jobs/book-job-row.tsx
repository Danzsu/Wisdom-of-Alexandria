"use client";

/**
 * Job-row body for a `book_generate` job (V2 — book automation).
 *
 * Renders the live BOOK-level progress derived from `output_data`
 * (`{total_chapters, completed_chapters, total_scenes, completed, failed,
 * skipped, chapters:[{chapter_id, scenes:[...]}]}` — committed by the worker
 * after each scene/chapter): a "{n}/{m} fejezet kész" line, the per-scene
 * tally line (the SAME composition the chapter job uses) and a
 * {@link ProgressBar}, then ONE COLLAPSIBLE GROUP PER CHAPTER, each reusing
 * the existing per-scene review row ({@link ChapterSceneRow} — Elfogad is the
 * SAME human-in-the-loop approve flow: `POST /revisions/{id}/approve`; this
 * component builds NO new approve route).
 *
 * Titles are resolved best-effort from the REAL data (the book's chapter list
 * + each chapter's scene list, under the shared cache keys); an unknown id
 * falls back to a generic label — never a crash. The per-revision APPROVED
 * state is derived honestly from `GET /revisions?scene_id=` (shared
 * {@link revisionKeys} cache), exactly like the chapter body. The list polls
 * implicitly with the parent jobs list (~5s), so progress advances live.
 */
import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { ProgressBar } from "@/components/kit/progress-bar";
import { listChapters } from "@/lib/api/chapters";
import { listScenes } from "@/lib/api/scenes";
import { queryKeys } from "@/lib/api/hooks";
import { listRevisions } from "@/lib/api/revisions";
import { revisionKeys } from "@/lib/api/revision-hooks";
import { type GenerationJobRead } from "@/lib/api/ai-types";
import { hu } from "@/lib/i18n/hu";
import {
  ChapterSceneRow,
  readSceneEntries,
  type ChapterSceneEntry,
} from "./chapter-job-row";

/** One per-chapter group of `output_data.chapters`. */
interface BookChapterEntry {
  chapter_id: string;
  scenes: ChapterSceneEntry[];
}

/** The live book-level progress shape the worker commits into `output_data`. */
interface BookProgress {
  totalChapters: number;
  completedChapters: number;
  totalScenes: number;
  completed: number;
  failed: number;
  skippedCount: number;
  chapters: BookChapterEntry[];
}

/** Coerce an unknown to a finite non-negative integer (default 0). */
function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

/** Parse the tolerant `output_data` JSON into a typed {@link BookProgress}. */
function readBookProgress(
  outputData: GenerationJobRead["output_data"],
): BookProgress {
  const data = (outputData ?? {}) as Record<string, unknown>;
  const skipped = Array.isArray(data.skipped) ? data.skipped : [];
  const rawChapters = Array.isArray(data.chapters) ? data.chapters : [];
  const chapters: BookChapterEntry[] = rawChapters
    .filter(
      (c): c is Record<string, unknown> => typeof c === "object" && c !== null,
    )
    .map((c) => ({
      chapter_id: typeof c.chapter_id === "string" ? c.chapter_id : "",
      scenes: readSceneEntries(c.scenes),
    }))
    .filter((c) => c.chapter_id.length > 0);
  return {
    totalChapters: asCount(data.total_chapters),
    completedChapters: asCount(data.completed_chapters),
    totalScenes: asCount(data.total_scenes),
    completed: asCount(data.completed),
    failed: asCount(data.failed),
    skippedCount: skipped.length,
    chapters,
  };
}

export interface BookJobBodyProps {
  job: GenerationJobRead;
  /** Owning book — drives title resolution + the per-scene "Megnyitás" link. */
  bookId: string | undefined;
}

/** The book-generate progress + per-chapter review body (inside the job Card). */
export function BookJobBody({ job, bookId }: Readonly<BookJobBodyProps>) {
  const progress = useMemo(
    () => readBookProgress(job.output_data),
    [job.output_data],
  );

  // Per-chapter collapse state (all groups start EXPANDED for review).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleChapter = (chapterId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  // Resolve chapter titles from the book's chapter list (shared cache key).
  const chaptersQuery = useQuery({
    queryKey: queryKeys.bookChapters(bookId ?? "__none__"),
    queryFn: () => listChapters(bookId as string),
    enabled: Boolean(bookId) && progress.chapters.length > 0,
  });
  const chapterTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chapter of chaptersQuery.data ?? []) {
      map.set(chapter.id, chapter.title);
    }
    return map;
  }, [chaptersQuery.data]);

  // Resolve scene titles per chapter group (shared `chapterScenes` cache keys).
  const sceneListQueries = useQueries({
    queries: progress.chapters.map((entry) => ({
      queryKey: queryKeys.chapterScenes(entry.chapter_id),
      queryFn: () => listScenes(entry.chapter_id),
      enabled: entry.scenes.length > 0,
    })),
  });
  const sceneTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const query of sceneListQueries) {
      for (const scene of query.data ?? []) map.set(scene.id, scene.title);
    }
    return map;
    // The query array is fresh each render; key on the resolved data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneListQueries.map((q) => q.data?.length ?? -1).join(",")]);

  // Honest per-revision approved state from the REAL revision endpoint — one
  // query per done scene across ALL chapters (shared revisionKeys cache, so an
  // approve made anywhere flips here after invalidation).
  const allScenes = useMemo(
    () => progress.chapters.flatMap((c) => c.scenes),
    [progress.chapters],
  );
  const doneScenes = useMemo(
    () => allScenes.filter((s) => s.status === "done" && s.revision_id !== null),
    [allScenes],
  );
  const revisionQueries = useQueries({
    queries: doneScenes.map((scene) => ({
      queryKey: revisionKeys.scene(scene.scene_id),
      queryFn: () => listRevisions(scene.scene_id),
    })),
  });
  const approvedByRevisionId = new Map<string, boolean>();
  for (const query of revisionQueries) {
    for (const revision of query.data ?? []) {
      approvedByRevisionId.set(revision.id, revision.approved);
    }
  }

  const pct =
    progress.totalScenes > 0
      ? (progress.completed / progress.totalScenes) * 100
      : 0;

  return (
    <div className="flex flex-col gap-2">
      <ProgressBar
        value={pct}
        aria-label={hu.jobs.bookProgressAria(
          progress.completed,
          progress.totalScenes,
        )}
      />
      <p className="m-0 text-[12px] tabular-nums text-text-muted">
        <span className="font-semibold text-text-soft">
          {hu.jobs.bookChaptersProgress(
            progress.completedChapters,
            progress.totalChapters,
          )}
        </span>
        {" · "}
        <span>
          {hu.jobs.chapterProgress(
            progress.completed,
            progress.totalScenes,
            progress.failed,
            progress.skippedCount,
          )}
        </span>
      </p>

      {progress.chapters.length > 0 ? (
        <section className="mt-1 flex flex-col gap-2">
          {progress.chapters.map((entry) => (
            <BookChapterGroup
              key={entry.chapter_id}
              entry={entry}
              title={
                chapterTitleById.get(entry.chapter_id) ??
                hu.jobs.bookChapterFallbackTitle
              }
              open={!collapsed.has(entry.chapter_id)}
              onToggle={() => toggleChapter(entry.chapter_id)}
              bookId={bookId}
              sceneTitleById={sceneTitleById}
              approvedByRevisionId={approvedByRevisionId}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

interface BookChapterGroupProps {
  entry: BookChapterEntry;
  title: string;
  open: boolean;
  onToggle: () => void;
  bookId: string | undefined;
  sceneTitleById: Map<string, string>;
  approvedByRevisionId: Map<string, boolean>;
}

/**
 * One collapsible per-chapter group: a toggle header (chapter title + scene
 * tally) and, when open, the chapter's per-scene review rows — the SAME
 * {@link ChapterSceneRow} the chapter job renders (same approve flow).
 */
function BookChapterGroup({
  entry,
  title,
  open,
  onToggle,
  bookId,
  sceneTitleById,
  approvedByRevisionId,
}: Readonly<BookChapterGroupProps>) {
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={hu.jobs.bookChapterToggleAria(title)}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted"
      >
        <Icon icon={open ? ChevronDown : ChevronRight} size={14} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">
          {title}
        </span>
        <span className="text-[11px] tabular-nums text-text-faint">
          {hu.jobs.bookChapterSceneCount(entry.scenes.length)}
        </span>
      </button>
      {open ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-2 pt-0">
          {entry.scenes.map((scene) => (
            <ChapterSceneRow
              key={scene.scene_id}
              entry={scene}
              title={
                sceneTitleById.get(scene.scene_id) ??
                hu.jobs.chapterSceneFallbackTitle
              }
              bookId={bookId}
              approvedOnServer={
                scene.revision_id !== null &&
                approvedByRevisionId.get(scene.revision_id) === true
              }
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
