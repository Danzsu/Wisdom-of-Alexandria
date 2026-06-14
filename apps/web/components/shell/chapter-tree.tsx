"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { useBookTree, type ChapterWithScenes } from "@/lib/api/hooks";
import { useNavTo } from "@/lib/use-nav-to";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";

/**
 * 232px chapter-tree sidebar (Write route). Driven by `useBookTree(bookId)`:
 * collapsible chapters → scene rows; the active scene is accent-highlighted with
 * a left border; clicking a scene navigates to its Write route. Loading / error /
 * empty states are surfaced (the error is never swallowed). The active scene is
 * read from the `sceneId` route param.
 */
export function ChapterTree() {
  const params = useParams<{ bookId: string; sceneId?: string }>();
  const bookId = params?.bookId;
  const activeSceneId = params?.sceneId;
  const tree = useBookTree(bookId);

  return (
    <nav
      aria-label={hu.write.chapterTreeAria}
      className="flex w-tree flex-none flex-col border-r border-border bg-bg-subtle"
    >
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {hu.write.chaptersHeading}
        </span>
        <button
          type="button"
          aria-label={hu.write.newChapterAria}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <Icon icon={Plus} size={14} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2 pb-2">
        {tree.isLoading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-[13px] text-text-faint">
            <Spinner size={13} />
            {hu.write.treeLoading}
          </div>
        ) : tree.isError ? (
          <p className="m-0 px-2 py-3 text-[13px] text-danger-text">
            {hu.write.treeError}
          </p>
        ) : tree.chapters.length === 0 ? (
          <p className="m-0 px-2 py-3 text-[13px] text-text-faint">
            {hu.write.treeEmpty}
          </p>
        ) : (
          tree.chapters.map((chapter) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              bookId={bookId ?? ""}
              activeSceneId={activeSceneId}
            />
          ))
        )}
      </div>

      <div className="flex flex-none items-center gap-[7px] border-t border-border px-3.5 py-3">
        <BrandStar size={11} className="opacity-70" />
        <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
          {hu.brandFull}
        </span>
      </div>
    </nav>
  );
}

/** One collapsible chapter with its scene rows. */
function ChapterRow({
  chapter,
  bookId,
  activeSceneId,
}: {
  chapter: ChapterWithScenes;
  bookId: string;
  activeSceneId: string | undefined;
}) {
  // Chapters start expanded so the active scene is always visible.
  const [open, setOpen] = useState(true);
  const navTo = useNavTo();

  return (
    <div className="flex flex-col gap-px">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-[7px] rounded-lg px-2 text-left text-[13px] font-medium text-text hover:bg-surface-muted"
      >
        <Icon icon={open ? ChevronDown : ChevronRight} size={13} />
        <span className="flex-1 truncate">{chapter.title}</span>
        <span className="text-[11px] tabular-nums text-text-muted">
          {chapter.scenes.length}
        </span>
      </button>

      {open ? (
        chapter.scenes.length === 0 ? (
          <p className="m-0 px-2 py-1.5 pl-[34px] text-[12px] text-text-faint">
            {hu.write.sceneEmpty}
          </p>
        ) : (
          chapter.scenes.map((scene) => {
            const active = scene.id === activeSceneId;
            return (
              <button
                key={scene.id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => navTo(routes.scene(bookId, scene.id))}
                className={cn(
                  "flex h-7 items-center gap-[7px] rounded-lg px-2 pl-8 text-left text-[13px]",
                  active
                    ? "border-l-2 border-accent bg-accent-muted font-medium text-accent-text"
                    : "text-text-muted hover:bg-surface-muted hover:text-text",
                )}
              >
                <span className="flex-1 truncate">
                  {scene.title || hu.write.sceneFallbackTitle}
                </span>
              </button>
            );
          })
        )
      ) : null}
    </div>
  );
}
