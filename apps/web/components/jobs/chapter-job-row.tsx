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
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, X } from "lucide-react";
import { Button } from "@/components/kit/button";
import { Badge } from "@/components/kit/badge";
import { Icon } from "@/components/kit/icon";
import { ProgressBar } from "@/components/kit/progress-bar";
import { toast } from "@/components/kit/toast";
import { useApproveRevision } from "@/lib/api/ai-hooks";
import { listScenes } from "@/lib/api/scenes";
import { queryKeys } from "@/lib/api/hooks";
import { useNavTo } from "@/lib/use-nav-to";
import { routes } from "@/lib/routes";
import { type GenerationJobRead } from "@/lib/api/ai-types";
import { hu } from "@/lib/i18n/hu";

/** One entry of `output_data.scenes`, narrowed from the tolerant JSON record. */
interface ChapterSceneEntry {
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

/** Parse the tolerant `output_data` JSON into a typed {@link ChapterProgress}. */
function readProgress(
  outputData: GenerationJobRead["output_data"],
): ChapterProgress {
  const data = (outputData ?? {}) as Record<string, unknown>;
  const skipped = Array.isArray(data.skipped) ? data.skipped : [];
  const rawScenes = Array.isArray(data.scenes) ? data.scenes : [];
  const scenes: ChapterSceneEntry[] = rawScenes
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
  return {
    total: asCount(data.total),
    completed: asCount(data.completed),
    failed: asCount(data.failed),
    skippedCount: skipped.length,
    scenes,
  };
}

/** One reviewable scene row: status pill + (for a done revision) accept/open. */
function ChapterSceneRow({
  entry,
  title,
  bookId,
}: {
  entry: ChapterSceneEntry;
  title: string;
  bookId: string | undefined;
}) {
  const approve = useApproveRevision();
  const navTo = useNavTo();
  const isDone = entry.status === "done";
  const revisionId = entry.revision_id;
  const canApprove = isDone && revisionId !== null && !approve.isSuccess;

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-surface-muted px-2.5 py-2">
      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{title}</span>
      <Badge variant={isDone ? "success" : "danger"} size={20}>
        {isDone ? hu.jobs.chapterSceneDone : hu.jobs.chapterSceneFailed}
      </Badge>
      {approve.isSuccess ? (
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
              onSuccess: () => toast.success(hu.jobs.chapterSceneAcceptedToast),
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

      {progress.scenes.length > 0 ? (
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
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
