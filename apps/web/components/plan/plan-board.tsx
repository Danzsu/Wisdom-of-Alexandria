"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { Spinner } from "@/components/kit/spinner";
import { Icon } from "@/components/kit/icon";
import { ErrorBoundary } from "@/components/kit/error-boundary";
import { hu } from "@/lib/i18n/hu";
import { usePlanBoard } from "./use-plan-board";
import { PlanHeader } from "./plan-header";
import { PlanGrid } from "./plan-grid";
import { PlanMatrix } from "./plan-matrix";
import { PlanOutline } from "./plan-outline";
import { PlanActionBar } from "./plan-action-bar";
import type { PlanDensity, PlanView } from "./types";

/**
 * Plan Board screen (the `terv` route body). Owns the view / density / search UI
 * state; the data + actions come from {@link usePlanBoard}. Renders the header,
 * then the body (loading / error / empty-book / no-search-match / the active
 * view), then the bottom action bar.
 *
 * The empty-book state is the create→write loop's entry point: "Első fejezet
 * létrehozása" creates a chapter + a first scene and opens it in the editor.
 */
export function PlanBoard() {
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId;

  const [view, setView] = useState<PlanView>("grid");
  const [density, setDensity] = useState<PlanDensity>("default");
  const [search, setSearch] = useState("");

  const controller = usePlanBoard({ bookId, search });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The header gets its OWN boundary so a header crash (view/density/search
          controls) degrades to a compact in-pane fallback instead of bubbling to
          the route boundary and white-screening the whole view — the body below
          keeps its independent boundary and stays usable. */}
      <ErrorBoundary>
        <PlanHeader
          bookId={bookId}
          view={view}
          onViewChange={setView}
          density={density}
          onDensityChange={setDensity}
          search={search}
          onSearchChange={setSearch}
        />
      </ErrorBoundary>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        {/* A render failure inside a view (grid/matrix/outline) degrades to a
            compact in-pane fallback instead of bubbling to the route boundary;
            the header + action bar stay usable. Keyed on the view so switching
            views re-mounts a clean subtree. */}
        <ErrorBoundary key={view}>
          <PlanBody controller={controller} view={view} density={density} />
        </ErrorBoundary>
      </div>

      <PlanActionBar
        onAddAct={controller.createChapter}
        isCreating={controller.isCreating}
      />
    </div>
  );
}

function PlanBody({
  controller,
  view,
  density,
}: {
  controller: ReturnType<typeof usePlanBoard>;
  view: PlanView;
  density: PlanDensity;
}) {
  const params = useParams<{ sceneId?: string }>();

  if (controller.isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-text-muted">
        <Spinner size={14} />
        {hu.plan.loading}
      </div>
    );
  }

  if (controller.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="m-0 text-[14px] font-semibold text-danger-text">
          {hu.plan.error}
        </p>
        <p className="m-0 max-w-md text-[13px] text-text-muted">
          {controller.error?.message}
        </p>
      </div>
    );
  }

  // Empty BOOK (no chapters at all) — the create→write loop entry point.
  if (!controller.hasAnyChapter) {
    return <EmptyBook controller={controller} />;
  }

  // No scenes match an active search filter (book has chapters, but nothing
  // matched). Distinct from the empty-book state above.
  if (controller.chapters.length === 0) {
    return (
      <p className="m-0 py-10 text-center text-[13px] text-text-muted">
        {hu.plan.emptyHint}
      </p>
    );
  }

  if (view === "matrix") return <PlanMatrix controller={controller} />;
  if (view === "outline") {
    return (
      <PlanOutline controller={controller} activeSceneId={params?.sceneId} />
    );
  }
  return <PlanGrid controller={controller} density={density} />;
}

/** Empty-book CTA: creates the first chapter (+ first scene) and opens it. */
function EmptyBook({
  controller,
}: {
  controller: ReturnType<typeof usePlanBoard>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted text-accent-text">
        <BrandStar size={26} />
      </span>
      <p className="m-0 text-[15px] font-semibold text-text">
        {hu.plan.emptyTitle}
      </p>
      <p className="m-0 max-w-[360px] text-[13px] leading-[1.5] text-text-muted">
        {hu.plan.emptyHint}
      </p>
      <button
        type="button"
        onClick={controller.createFirstChapter}
        disabled={controller.isCreating}
        className="mt-1 flex h-9 items-center gap-1.5 rounded-lg bg-accent-strong px-3.5 text-[13px] font-semibold text-accent-fg hover:opacity-90 disabled:opacity-50"
      >
        <Icon icon={Plus} size={14} />
        {hu.plan.emptyCta}
      </button>
    </div>
  );
}
