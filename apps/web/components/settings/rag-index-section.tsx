"use client";

import { useParams } from "next/navigation";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/kit/button";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { Spinner } from "@/components/kit/spinner";
import { hu } from "@/lib/i18n/hu";
import { useBookProjectId, useRebuildIndex } from "@/lib/api/ai-hooks";

/**
 * RAG index rebuild section (Beállítások hub, P1L-1). Enqueues an async project
 * re-index on the worker and polls the job to completion, showing the live
 * status + final counts. The project is resolved from the route `bookId`
 * (Settings is book-scoped, the index is project-scoped). The button is disabled
 * until the project id resolves and while a rebuild is in flight.
 */
export function RagIndexSection() {
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId;
  const { data: projectId } = useBookProjectId(bookId);
  const { trigger, job, isRunning, error } = useRebuildIndex(projectId);

  return (
    <section>
      <SectionEyebrow as="h3" className="mb-2 mt-7">
        {hu.settings.ragIndexLabel}
      </SectionEyebrow>
      <div className="rounded-[14px] border border-border bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] bg-ai-muted text-ai-text">
            <DatabaseZap size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-text">
              {hu.settings.ragIndexTitle}
            </p>
            <p className="mt-0.5 text-[12px] text-text-muted">
              {hu.settings.ragIndexHint}
            </p>
          </div>
          <Button
            type="button"
            variant="accent-outline"
            onClick={trigger}
            disabled={!projectId || isRunning}
            aria-label={hu.settings.ragIndexButtonAria}
            leadingIcon={isRunning ? <Spinner size={14} /> : undefined}
          >
            {hu.settings.ragIndexButton}
          </Button>
        </div>
        <RebuildStatus job={job} isRunning={isRunning} hasError={Boolean(error)} />
      </div>
    </section>
  );
}

/**
 * The live status line under the rebuild button: running spinner text, the
 * sanitized error, the no-provider notice, or the final counts. Renders nothing
 * before the first rebuild (no job, not running, no error).
 */
function RebuildStatus({
  job,
  isRunning,
  hasError,
}: {
  job: ReturnType<typeof useRebuildIndex>["job"];
  isRunning: boolean;
  hasError: boolean;
}) {
  if (isRunning) {
    return (
      <p className="mt-3 text-[12px] text-text-muted" role="status">
        {hu.settings.ragIndexRunning}
      </p>
    );
  }
  if (hasError || job?.status === "failed") {
    return (
      <p className="mt-3 text-[12px] text-danger" role="status">
        {hu.settings.ragIndexError}
      </p>
    );
  }
  if (job?.status === "done") {
    const out = job.output_data ?? {};
    if (out.skipped_no_provider === true) {
      return (
        <p className="mt-3 text-[12px] text-text-muted" role="status">
          {hu.settings.ragIndexNoProvider}
        </p>
      );
    }
    return (
      <p className="mt-3 text-[12px] text-success-text" role="status">
        {hu.settings.ragIndexDone({
          indexed: Number(out.indexed ?? 0),
          updated: Number(out.updated ?? 0),
          deleted: Number(out.deleted ?? 0),
          skipped: Number(out.skipped ?? 0),
        })}
      </p>
    );
  }
  return null;
}
