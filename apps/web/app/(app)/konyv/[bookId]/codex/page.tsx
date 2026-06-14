"use client";

/**
 * Codex screen main area (the `<main>` beside the Codex sidebar). Renders the
 * selected entry's detail. Selection is the `?entry` query param, shared with
 * the sidebar via {@link useCodexSelection}; the editor's "Megnyitás a Codexben"
 * mention deep-links here with that param set.
 *
 * Codex is project-scoped but the route only carries `bookId`, so the owning
 * project id is resolved through the reused M5 `useBookProjectId` resolver.
 */
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { BrandStar } from "@/components/kit/brand-star";
import { Spinner } from "@/components/kit/spinner";
import { useBookProjectId } from "@/lib/api/ai-hooks";
import { useCodexEntries } from "@/lib/api/hooks";
import { useCodexSelection } from "@/components/codex/use-codex-selection";
import { CodexDetail } from "@/components/codex/codex-detail";
import { hu } from "@/lib/i18n/hu";

export default function CodexPage() {
  // useSearchParams (inside useCodexSelection) requires a Suspense boundary.
  return (
    <Suspense fallback={<CodexLoading />}>
      <CodexScreen />
    </Suspense>
  );
}

function CodexLoading() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-text-muted">
      <Spinner size={14} />
      {hu.codex.listLoading}
    </div>
  );
}

function CodexScreen() {
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId;
  const projectIdQuery = useBookProjectId(bookId);
  const projectId = projectIdQuery.data;
  const codex = useCodexEntries(projectId);
  const { selectedId, clear } = useCodexSelection();

  const entry = selectedId
    ? (codex.data ?? []).find((e) => e.id === selectedId)
    : undefined;

  if (codex.isError || projectIdQuery.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="m-0 text-[14px] font-semibold text-danger-text">
          {hu.codex.listError}
        </p>
        <p className="m-0 max-w-md text-[13px] text-text-muted">
          {(codex.error ?? projectIdQuery.error)?.message}
        </p>
      </div>
    );
  }

  if (codex.isLoading || projectIdQuery.isLoading) {
    return <CodexLoading />;
  }

  if (!entry || !projectId) {
    return <CodexEmptyState />;
  }

  return (
    <CodexDetail
      key={entry.id}
      entry={entry}
      projectId={projectId}
      bookId={bookId}
      onDeleted={clear}
    />
  );
}

/** Shown when no entry is selected (the default Codex landing). */
function CodexEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted text-accent-text">
        <BrandStar size={26} />
      </span>
      <p className="m-0 text-[15px] font-semibold text-text">
        {hu.codex.listEmptyTitle}
      </p>
      <p className="m-0 max-w-[340px] text-[13px] leading-[1.5] text-text-muted">
        {hu.codex.listEmptyHint}
      </p>
    </div>
  );
}
