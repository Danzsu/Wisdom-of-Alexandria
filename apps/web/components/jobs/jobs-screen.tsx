"use client";

/**
 * AI feladatok screen (B1) — the live generation-jobs list for a book.
 *
 * Reads the real GenerationJob records via {@link useJobs} (book-scoped on the
 * server, polled ~5s so it stays live). Each row shows the localized job type, a
 * status badge, the relative created time, the scene/chapter context, and — on a
 * failure — the sanitized error message in an expandable block. Loading shows a
 * skeleton, an empty book shows a friendly empty state, and a fetch error shows a
 * dedicated error state (never a swallowed rejection).
 *
 * Status / job-type rendering degrades gracefully: an UNKNOWN status falls back
 * to a neutral pill with the raw value, and an unknown job_type falls back to its
 * raw string — neither crashes the list.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import { Card } from "@/components/kit/card";
import { Badge, type BadgeProps } from "@/components/kit/badge";
import { Icon } from "@/components/kit/icon";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/kit";
import { useJobs } from "@/lib/api/ai-hooks";
import { asJobStatus, type GenerationJobRead } from "@/lib/api/ai-types";
import { ChapterJobBody } from "./chapter-job-row";
import { hu } from "@/lib/i18n/hu";

/** Map a known job status → Badge variant + label. */
const STATUS_META: Record<
  string,
  { variant: NonNullable<BadgeProps["variant"]>; label: string }
> = {
  pending: { variant: "neutral", label: hu.jobs.statusPending },
  running: { variant: "ai", label: hu.jobs.statusRunning },
  done: { variant: "success", label: hu.jobs.statusDone },
  failed: { variant: "danger", label: hu.jobs.statusFailed },
};

/** Map a known job_type → localized label. */
const TYPE_LABEL: Record<string, string> = {
  rewrite: hu.jobs.typeRewrite,
  describe: hu.jobs.typeDescribe,
  generate_scene: hu.jobs.typeGenerateScene,
  write_continue: hu.jobs.typeWriteContinue,
  summarize: hu.jobs.typeSummarize,
  chapter_generate: hu.jobs.typeChapterGenerate,
};

/** Localized job-type label, falling back to the raw value when unknown. */
function jobTypeLabel(jobType: string): string {
  return TYPE_LABEL[jobType] ?? jobType;
}

/** Status badge for a job; unknown statuses render a neutral pill + raw value. */
function StatusBadge({ status }: { status: string }) {
  const known = asJobStatus(status);
  const meta = known ? STATUS_META[known] : null;
  return (
    <Badge variant={meta?.variant ?? "neutral"} size={20}>
      {meta?.label ?? status}
    </Badge>
  );
}

/** Context line: the scene or chapter the job belongs to (or "not bound"). */
function JobContext({ job }: { job: GenerationJobRead }) {
  let text: string;
  if (job.scene_id) {
    text = `${hu.jobs.contextScene} · ${job.scene_id}`;
  } else if (job.chapter_id) {
    text = `${hu.jobs.contextChapter} · ${job.chapter_id}`;
  } else {
    text = hu.jobs.contextNone;
  }
  return <span className="truncate text-[12px] text-text-faint">{text}</span>;
}

/** A single job row (card). Failed jobs expose an expandable error block. */
function JobRow({
  job,
  bookId,
}: {
  job: GenerationJobRead;
  bookId: string | undefined;
}) {
  const [errorOpen, setErrorOpen] = useState(false);
  const isFailed = job.status === "failed";
  const isChapterGenerate = job.job_type === "chapter_generate";
  const errorText = job.error_message?.trim() || hu.jobs.errorUnknown;

  return (
    <Card accentEdge={isFailed ? "danger" : undefined}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-text">
            {jobTypeLabel(job.job_type)}
          </span>
          <StatusBadge status={job.status} />
          <span className="ml-auto text-[12px] text-text-muted">
            {hu.jobs.relativeCreated(job.created_at)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <JobContext job={job} />
          {job.model_name ? (
            <span className="text-[12px] text-text-faint">
              {hu.jobs.modelLabel}: {job.model_name}
            </span>
          ) : null}
        </div>

        {isChapterGenerate ? <ChapterJobBody job={job} bookId={bookId} /> : null}

        {isFailed ? (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setErrorOpen((open) => !open)}
              aria-expanded={errorOpen}
              className="inline-flex items-center gap-1 rounded-md text-[12px] font-semibold text-danger-text hover:underline"
            >
              <Icon
                icon={errorOpen ? ChevronDown : ChevronRight}
                size={13}
              />
              {errorOpen ? hu.jobs.errorToggleHide : hu.jobs.errorToggleShow}
            </button>
            {errorOpen ? (
              <div className="mt-1.5 rounded-lg border border-danger/30 bg-danger-muted p-2.5">
                <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-wide text-danger-text">
                  {hu.jobs.errorHeading}
                </p>
                <p className="m-0 whitespace-pre-wrap break-words text-[12px] leading-[1.5] text-danger-text">
                  {errorText}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}


export interface JobsScreenProps {
  /** Active book id (from the route). The list is scoped to it server-side. */
  bookId: string | undefined;
}

/** The AI feladatok screen body. */
export function JobsScreen({ bookId }: JobsScreenProps) {
  const jobs = useJobs(bookId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[18px] font-semibold text-text">
          {hu.jobs.title}
        </h1>
        <p className="m-0 text-[13px] text-text-muted">{hu.jobs.subtitle}</p>
      </header>

      {jobs.isError ? (
        <ErrorState
          message={hu.jobs.errorTitle}
          detail={jobs.error?.message}
          onRetry={() => void jobs.refetch()}
        />
      ) : jobs.isLoading ? (
        <div className="flex flex-col gap-3" role="status" aria-label={hu.jobs.loadingAria}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (jobs.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Icon icon={ListChecks} size={26} />}
          title={hu.jobs.emptyTitle}
          description={hu.jobs.emptyHint}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(jobs.data ?? []).map((job) => (
            <JobRow key={job.id} job={job} bookId={bookId} />
          ))}
        </div>
      )}
    </div>
  );
}
