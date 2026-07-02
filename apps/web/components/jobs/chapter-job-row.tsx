"use client";

/**
 * Job-row body for a `chapter_generate` job (T5 — chapter automation).
 *
 * Renders the live per-scene progress derived from `output_data`
 * (`{total, completed, failed, skipped, scenes}`) — a compact
 * "{completed}/{total} kész · {failed} sikertelen · {skipped} kihagyva" line plus
 * a {@link ProgressBar} — and, once scenes exist, a review list: one row per
 * generated scene with its status and, for a `done` scene that still has a
 * pending (unapproved) revision, an inline "Elfogad" button + a "Megnyitás" link
 * to the scene's Write view.
 *
 * The accept reuses the EXISTING human-in-the-loop approve path
 * ({@link useApproveRevision} → `POST /revisions/{id}/approve`); this component
 * builds NO new approve route. Failed scenes (no revision) are listed but expose
 * no accept. The list polls implicitly with the parent jobs list (~5s), so a
 * pending job's progress advances live without a manual refresh.
 *
 * "Fejezet kész" signal (gap-fix #4): the per-scene APPROVED state is derived
 * honestly from the real revision endpoint (`GET /revisions?scene_id=` →
 * `approved`), cached under the shared {@link revisionKeys} so the revision
 * browser and this row agree. Once EVERY scene is `done` AND every revision is
 * approved, the review list is replaced by a success banner; an inline accept
 * invalidates that scene's revision list so the banner flips live after the
 * last approve. A failed scene keeps the banner away — "minden jelenet
 * jóváhagyva" must never overstate.
 */
import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BadgeCheck, Check, X } from "lucide-react";
import { Button } from "@/components/kit/button";
import { Badge } from "@/components/kit/badge";
import { Icon } from "@/components/kit/icon";
import { ProgressBar } from "@/components/kit/progress-bar";
import { toast } from "@/components/kit/toast";
import { useApproveRevision } from "@/lib/api/ai-hooks";
import { listScenes } from "@/lib/api/scenes";
import { queryKeys } from "@/lib/api/hooks";
import { listRevisions } from "@/lib/api/revisions";
import { revisionKeys } from "@/lib/api/revision-hooks";
import { useNavTo } from "@/lib/use-nav-to";
import { routes } from "@/lib/routes";
import { type GenerationJobRead } from "@/lib/api/ai-types";
import { hu } from "@/lib/i18n/hu";

/** One entry of `output_data.scenes`, narrowed from the tolerant JSON record.
 * Shared with the book-job body ({@link ../book-job-row}) — the book worker
 * writes the SAME per-scene entries inside each `chapters[]` group. */
export interface ChapterSceneEntry {
  scene_id: string;
  revision_id: string | null;
  status: string;
  warning_count: number;
  error?: string | null;
}

/** The live progress shape the worker commits into `output_data`. */
interface ChapterProgress {
  total: number;
  completed: number;
  failed: number;
  skippedCount: number;
  scenes: ChapterSceneEntry[];
}

/** Coerce an unknown to a finite non-negative integer (default 0). */
function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

/**
 * Narrow a raw JSON array into typed {@link ChapterSceneEntry} rows (tolerant:
 * malformed entries are dropped, never thrown on). Exported for the book-job
 * body, which parses the same per-scene entries out of each chapter group.
 */
export function readSceneEntries(raw: unknown): ChapterSceneEntry[] {
  const rawScenes = Array.isArray(raw) ? raw : [];
  return rawScenes
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      scene_id: typeof s.scene_id === "string" ? s.scene_id : "",
      revision_id:
        typeof s.revision_id === "string" && s.revision_id.length > 0
          ? s.revision_id
          : null,
      status: typeof s.status === "string" ? s.status : "",
      warning_count: asCount(s.warning_count),
      error: typeof s.error === "string" ? s.error : null,
    }))
    .filter((s) => s.scene_id.length > 0);
}

/** Parse the tolerant `output_data` JSON into a typed {@link ChapterProgress}. */
function readProgress(
  outputData: GenerationJobRead["output_data"],
): ChapterProgress {
  const data = (outputData ?? {}) as Record<string, unknown>;
  const skipped = Array.isArray(data.skipped) ? data.skipped : [];
  return {
    total: asCount(data.total),
    completed: asCount(data.completed),
    failed: asCount(data.failed),
    skippedCount: skipped.length,
    scenes: readSceneEntries(data.scenes),
  };
}

/** One reviewable scene row: status pill + (for a done revision) accept/open.
 * Exported so the book-job body reuses the SAME review row (same approve flow). */
export function ChapterSceneRow({
  entry,
  title,
  bookId,
  approvedOnServer,
}: {
  entry: ChapterSceneEntry;
  title: string;
  bookId: string | undefined;
  /** True when the scene's revision is already approved per the backend. */
  approvedOnServer: boolean;
}) {
  const approve = useApproveRevision();
  const queryClient = useQueryClient();
  const navTo = useNavTo();
  const isDone = entry.status === "done";
  const revisionId = entry.revision_id;
  const isApproved = approvedOnServer || approve.isSuccess;
  const canApprove = isDone && revisionId !== null && !isApproved;

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-surface-muted px-2.5 py-2">
      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{title}</span>
      <Badge variant={isDone ? "success" : "danger"} size={20}>
        {isDone ? hu.jobs.chapterSceneDone : hu.jobs.chapterSceneFailed}
      </Badge>
      {isApproved ? (
        <Badge variant="neutral" size={20}>
          {hu.jobs.chapterSceneApproved}
        </Badge>
      ) : null}
      {canApprove ? (
        <Button
          type="button"
          variant="accent-outline"
          size={28}
          loading={approve.isPending}
          leadingIcon={<Icon icon={Check} size={13} />}
          aria-label={hu.jobs.chapterSceneAcceptAria(title)}
          onClick={() =>
            approve.mutate(revisionId, {
              onSuccess: () => {
                toast.success(hu.jobs.chapterSceneAcceptedToast);
                // Refresh the scene's revision list so the derived approved
                // state (and the "Fejezet kész" banner) flips live.
                void queryClient.invalidateQueries({
                  queryKey: revisionKeys.scene(entry.scene_id),
                });
              },
              onError: () => toast.error(hu.jobs.chapterSceneAcceptErrorToast),
            })
          }
        >
          {hu.jobs.chapterSceneAccept}
        </Button>
      ) : null}
      {bookId ? (
        <Button
          type="button"
          variant="ghost"
          size={28}
          trailingIcon={<Icon icon={isDone ? ArrowUpRight : X} size={13} />}
          aria-label={hu.jobs.chapterSceneOpenAria(title)}
          onClick={() => navTo(routes.scene(bookId, entry.scene_id))}
        >
          {hu.jobs.chapterSceneOpen}
        </Button>
      ) : null}
    </li>
  );
}

export interface ChapterJobBodyProps {
  job: GenerationJobRead;
  /** Owning book — drives the per-scene "Megnyitás" link. */
  bookId: string | undefined;
}

/** The chapter-generate progress + review body (rendered inside the job Card). */
export function ChapterJobBody({ job, bookId }: ChapterJobBodyProps) {
  const progress = useMemo(() => readProgress(job.output_data), [job.output_data]);

  // Resolve scene titles from the job's chapter (best-effort; a scene not in the
  // chapter's current list falls back to a generic title — the id still links).
  const chapterId = job.chapter_id ?? undefined;
  const scenesQuery = useQuery({
    queryKey: queryKeys.chapterScenes(chapterId ?? "__none__"),
    queryFn: () => listScenes(chapterId as string),
    enabled: Boolean(chapterId) && progress.scenes.length > 0,
  });
  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const scene of scenesQuery.data ?? []) map.set(scene.id, scene.title);
    return map;
  }, [scenesQuery.data]);

  // Derive the honest per-revision approved state from the REAL revision
  // endpoint, one query per done scene (shared cache key with the revision
  // browser, so an approve made anywhere is reflected here after invalidation).
  const doneScenes = useMemo(
    () =>
      progress.scenes.filter(
        (s) => s.status === "done" && s.revision_id !== null,
      ),
    [progress.scenes],
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

  // "Fejezet kész" only when EVERY scene generated (done, has a revision) AND
  // every revision is confirmed approved by fetched data. A failed scene, a
  // pending revision, or a not-yet-loaded revision list keeps the review list.
  const chapterComplete =
    progress.scenes.length > 0 &&
    progress.scenes.every(
      (s) => s.status === "done" && s.revision_id !== null,
    ) &&
    doneScenes.every(
      (s) =>
        s.revision_id !== null &&
        approvedByRevisionId.get(s.revision_id) === true,
    );

  const pct = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      <ProgressBar
        value={pct}
        aria-label={hu.jobs.chapterProgressAria(progress.completed, progress.total)}
      />
      <p className="m-0 text-[12px] tabular-nums text-text-muted">
        {hu.jobs.chapterProgress(
          progress.completed,
          progress.total,
          progress.failed,
          progress.skippedCount,
        )}
      </p>

      {chapterComplete ? (
        <p
          role="status"
          className="m-0 mt-1 flex items-center gap-2 rounded-lg bg-success-muted px-3 py-2 text-[13px] font-semibold text-success-text"
        >
          <Icon icon={BadgeCheck} size={15} />
          {hu.jobs.chapterDoneAll}
        </p>
      ) : progress.scenes.length > 0 ? (
        <section className="mt-1 flex flex-col gap-1.5">
          <h2 className="m-0 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            {hu.jobs.chapterScenesHeading}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {progress.scenes.map((entry) => (
              <ChapterSceneRow
                key={entry.scene_id}
                entry={entry}
                title={titleById.get(entry.scene_id) ?? hu.jobs.chapterSceneFallbackTitle}
                bookId={bookId}
                approvedOnServer={
                  entry.revision_id !== null &&
                  approvedByRevisionId.get(entry.revision_id) === true
                }
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
