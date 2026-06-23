"use client";

/**
 * Idősor screen (UX-3b) — a vertical, reading-order timeline of the book's
 * chapters → scenes, coloured by POV + status, with click/keyboard navigation to
 * a scene's Write view. FRONTEND-ONLY: it reads the EXISTING book tree
 * (`useBookTree`) + the project's codex entries (to resolve POV character names);
 * no backend change. The CodexProgression overlay is a deferred follow-up.
 *
 * The route only carries `bookId`, so the owning project is resolved via the
 * reused `useBookProjectId` resolver (mirroring the Kapcsolatok screen) — needed
 * only to look up POV character names; the timeline itself is book-scoped.
 *
 * State handling mirrors Kapcsolatok: honest loading / error (with retry) /
 * empty (a calm prompt + a CTA to the Plan Board, never a blank canvas).
 *
 * Motion (progressive enhancement only): on mount GSAP draws the spine in
 * top→bottom (scaleY 0→1, transform-origin top) and staggers the scene nodes in
 * (fade + translateX). The STATIC render is the baseline — it is what tests
 * assert and what `prefers-reduced-motion` users (and the test env) see. GSAP is
 * imported dynamically (client-only), scoped via `gsap.context(...)` and fully
 * reverted on unmount — no leak, no SSR/test crash.
 *
 * Status → marker-state mapping (documented + unit-tested in
 * `./status-mapping.ts`): complete → "completed", in_progress → "current",
 * draft / archived / anything else → "planned".
 */
import { useEffect, useMemo, useRef } from "react";
import { BrandStar } from "@/components/kit/brand-star";
import { StatusPill, EmptyState, ErrorState, SkeletonList } from "@/components/kit";
import { Card } from "@/components/kit/card";
import { TimelineNode, TimelineSpine } from "@/components/kit/timeline";
import { useBookProjectId } from "@/lib/api/ai-hooks";
import {
  useBookTree,
  useCodexEntries,
  type ChapterWithScenes,
} from "@/lib/api/hooks";
import { useNavTo } from "@/lib/use-nav-to";
import { canAnimateGsapNow } from "@/lib/gsap-gate";
import { routes } from "@/lib/routes";
import { povSlot } from "@/lib/pov-color";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";
import type { SceneRead, CodexEntryRead } from "@/lib/api/types";
import { sceneStatusLabel, statusToMarkerState } from "./status-mapping";

export interface TimelineScreenProps {
  bookId: string | undefined;
}

/** StatusPill variant per scene status (colour is paired with the text label). */
function statusVariant(status: string): "success" | "ai" | "neutral" {
  if (status === "complete") return "success";
  if (status === "in_progress") return "ai";
  return "neutral";
}

/** POV dot/avatar classes for a 1-based POV slot. */
const POV_DOT_CLASS: Record<number, string> = {
  1: "bg-pov1-bg text-pov1-tx",
  2: "bg-pov2-bg text-pov2-tx",
  3: "bg-pov3-bg text-pov3-tx",
  4: "bg-pov4-bg text-pov4-tx",
  5: "bg-pov5-bg text-pov5-tx",
  6: "bg-pov6-bg text-pov6-tx",
};

/** Build 1–2 char initials from a name (mirrors the Avatar helper). */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A scene row enriched with its resolved POV character name (or null). */
interface ScenePov {
  /** The resolved POV character name, or null when unset/unresolvable. */
  name: string | null;
}

/** Resolve a scene's POV character name from the codex entries, if any. */
function resolveScenePov(
  scene: SceneRead,
  byId: Map<string, CodexEntryRead>,
): ScenePov {
  if (!scene.pov_character_id) return { name: null };
  const entry = byId.get(scene.pov_character_id);
  return { name: entry ? entry.title : null };
}

export function TimelineScreen({ bookId }: TimelineScreenProps) {
  const projectIdQuery = useBookProjectId(bookId);
  const projectId = projectIdQuery.data;
  const tree = useBookTree(bookId);
  // Codex entries resolve POV character names; this is best-effort context, so
  // a codex error never blocks the timeline (the dot just falls back to neutral).
  const entriesQuery = useCodexEntries(projectId);

  const navTo = useNavTo();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const entriesById = useMemo(() => {
    const map = new Map<string, CodexEntryRead>();
    for (const e of entriesQuery.data ?? []) map.set(e.id, e);
    return map;
  }, [entriesQuery.data]);

  // Chapters in reading order; scenes within each chapter in reading order.
  const chapters = useMemo<ChapterWithScenes[]>(() => {
    return [...tree.chapters]
      .sort((a, b) => a.order_index - b.order_index)
      .map((chapter) => ({
        ...chapter,
        scenes: [...chapter.scenes].sort(
          (a, b) => a.order_index - b.order_index,
        ),
      }));
  }, [tree.chapters]);

  const totalScenes = useMemo(
    () => chapters.reduce((n, c) => n + c.scenes.length, 0),
    [chapters],
  );

  // GSAP draw-in (client-only, reduced-motion/test-gated, fully reverted).
  useEffect(() => {
    if (!canAnimateGsapNow()) return;
    const root = rootRef.current;
    if (!root) return;

    let ctx: { revert: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const gsapMod = await import("gsap");
        if (cancelled) return;
        const gsap = gsapMod.gsap ?? gsapMod.default;
        ctx = gsap.context((self) => {
          const select = self.selector as
            | ((q: string) => Element[])
            | undefined;
          if (!select) return;
          // The spine draws top→bottom: scaleY 0→1 from the top edge.
          gsap.fromTo(
            select("[data-timeline-spine]"),
            { scaleY: 0, transformOrigin: "top center" },
            { scaleY: 1, duration: 0.5, ease: "power2.out" },
          );
          // Scene nodes stagger in: fade + a small translateX from the spine.
          gsap.fromTo(
            select("[data-timeline-node]"),
            { opacity: 0, x: -8 },
            {
              opacity: 1,
              x: 0,
              duration: 0.32,
              ease: "power2.out",
              stagger: 0.04,
              delay: 0.08,
            },
          );
        }, root);
      } catch {
        // GSAP chunk unavailable (offline): the static timeline already
        // rendered, so it stays fully readable. Log rather than swallow.
        if (!cancelled) {
          console.warn("[timeline-screen] GSAP unavailable; static timeline.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (ctx) ctx.revert();
    };
    // Re-run when the topology changes so freshly loaded nodes animate in.
  }, [chapters]);

  // Error — the book tree is the load-bearing source; surface its message + retry.
  if (tree.isError || projectIdQuery.isError) {
    const detail = (tree.error ?? projectIdQuery.error)?.message;
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <ErrorState
          message={hu.timeline.error}
          detail={detail}
          onRetry={() => {
            void tree.refetch();
            if (projectIdQuery.isError) void projectIdQuery.refetch();
          }}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  if (tree.isLoading) {
    return (
      <div className="flex flex-1 flex-col px-6 py-8">
        <SkeletonList rows={5} className="mx-auto w-full max-w-2xl" />
      </div>
    );
  }

  // Empty — a calm prompt + a CTA to the Plan Board, never a blank canvas.
  if (totalScenes === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <EmptyState
          icon={<BrandStar size={26} />}
          title={hu.timeline.emptyTitle}
          description={hu.timeline.emptyHint}
          action={{
            label: hu.timeline.emptyCta,
            onClick: () => bookId && navTo(routes.book(bookId, "terv")),
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar. */}
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <h1 className="m-0 font-serif text-[17px] font-semibold text-text">
          {hu.timeline.title}
        </h1>
        <span className="text-[12px] text-text-muted">
          {hu.timeline.chapterCount(chapters.length)} ·{" "}
          {hu.timeline.sceneCount(totalScenes)}
        </span>
      </header>

      {/* The timeline column. */}
      <div
        ref={rootRef}
        className="flex-1 overflow-y-auto px-6 py-6"
        role="region"
        aria-label={hu.timeline.listAriaLabel}
      >
        <div className="mx-auto max-w-2xl">
          {chapters.map((chapter) => (
            <section key={chapter.id} className="mb-8 last:mb-0">
              <header className="mb-4 flex items-baseline gap-2">
                <h2 className="m-0 font-serif text-[15px] font-semibold text-text">
                  {chapter.title}
                </h2>
                <span className="text-[12px] text-text-muted">
                  {hu.timeline.chapterScenes(chapter.scenes.length)}
                </span>
              </header>

              {/* The spine + nodes for this chapter's scenes. */}
              <div className="relative pl-7">
                <TimelineSpine data-timeline-spine />
                {chapter.scenes.map((scene) => {
                  const pov = resolveScenePov(scene, entriesById);
                  const slot = pov.name ? povSlot(pov.name) : null;
                  const statusLabel = sceneStatusLabel(scene.status);
                  const povTitle = pov.name
                    ? hu.timeline.povLabel(pov.name)
                    : hu.timeline.povUnset;
                  const href = bookId
                    ? routes.scene(bookId, scene.id)
                    : undefined;
                  return (
                    <TimelineNode
                      key={scene.id}
                      data-timeline-node
                      state={statusToMarkerState(scene.status)}
                    >
                      <Card
                        interactive
                        role="link"
                        tabIndex={0}
                        aria-label={hu.timeline.openSceneAria(scene.title)}
                        title={scene.summary ?? hu.timeline.noSummary}
                        className="cursor-pointer p-3 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={() => href && navTo(href)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (href) navTo(href);
                          }
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* POV dot/avatar — colour by character name, or a
                              neutral marker when no POV is set. */}
                          <span
                            aria-hidden="true"
                            title={povTitle}
                            className={cn(
                              "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-bold",
                              slot
                                ? POV_DOT_CLASS[slot]
                                : "border border-dashed border-border-strong bg-surface-muted text-text-faint",
                            )}
                          >
                            {pov.name ? initialsFrom(pov.name) : "·"}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-semibold text-text">
                                {scene.title}
                              </span>
                              <StatusPill
                                variant={statusVariant(scene.status)}
                                size={18}
                                className="ml-auto flex-none"
                              >
                                {statusLabel}
                              </StatusPill>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[12px] text-text-muted">
                              <span className="tabular-nums">
                                {hu.timeline.sceneWords(scene.word_count)}
                              </span>
                              {pov.name ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{pov.name}</span>
                                </>
                              ) : null}
                            </div>
                            {scene.summary ? (
                              <p className="m-0 mt-1.5 line-clamp-2 text-[12px] leading-[1.45] text-text-soft">
                                {scene.summary}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                    </TimelineNode>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
