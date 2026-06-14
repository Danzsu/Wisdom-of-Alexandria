"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  nextChapterOrderIndex,
  nextSceneOrderIndex,
  useBookTree,
  useCreateChapter,
  useCreateScene,
  type ChapterWithScenes,
} from "@/lib/api/hooks";
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
 *
 * M7: the header "+" creates a new chapter and the per-chapter "+ Új jelenet"
 * creates a scene and navigates to it (closing the create→write loop) — these
 * were non-functional before. Both use the M7 create mutations; errors surface
 * as a toast rather than being swallowed.
 */
export function ChapterTree() {
  const params = useParams<{ bookId: string; sceneId?: string }>();
  const bookId = params?.bookId;
  const activeSceneId = params?.sceneId;
  const queryClient = useQueryClient();
  const tree = useBookTree(bookId);
  const createChapter = useCreateChapter();
  // Synchronous in-flight guard: a closure-captured `isPending` would still read
  // false on a second click fired in the same render cycle, so the ref (set the
  // instant a create fires, cleared in onSettled) is what truly blocks the
  // double-fire from racing to the same append index (order_index collision fix).
  const creatingRef = useRef(false);

  const handleNewChapter = () => {
    if (!bookId || creatingRef.current) return;
    creatingRef.current = true;
    // Compute the index from the FRESHEST cache rather than a captured `.length`.
    const order = nextChapterOrderIndex(queryClient, bookId);
    createChapter.mutate(
      {
        bookId,
        data: {
          title: hu.plan.newChapterDefaultTitle(order + 1),
          order_index: order,
          status: "draft",
        },
      },
      {
        onSuccess: () => toast.success(hu.plan.toastChapterCreated),
        onError: () => toast.error(hu.plan.errorChapterCreate),
        onSettled: () => {
          creatingRef.current = false;
        },
      },
    );
  };

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
          onClick={handleNewChapter}
          disabled={createChapter.isPending || !bookId}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-50"
        >
          <Icon icon={Plus} size={14} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2 pb-2">
        {tree.isLoading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-[13px] text-text-muted">
            <Spinner size={13} />
            {hu.write.treeLoading}
          </div>
        ) : tree.isError ? (
          <p className="m-0 px-2 py-3 text-[13px] text-danger-text">
            {hu.write.treeError}
          </p>
        ) : tree.chapters.length === 0 ? (
          <p className="m-0 px-2 py-3 text-[13px] text-text-muted">
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

/** One collapsible chapter with its scene rows + a "+ Új jelenet" action. */
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
  const queryClient = useQueryClient();
  const createScene = useCreateScene();
  const creatingRef = useRef(false); // synchronous double-fire guard (see header)

  const handleNewScene = () => {
    if (creatingRef.current) return; // self-gate (see handleNewChapter)
    creatingRef.current = true;
    const order = nextSceneOrderIndex(queryClient, chapter.id);
    createScene.mutate(
      {
        chapterId: chapter.id,
        data: {
          title: hu.plan.newSceneDefaultTitle(order + 1),
          order_index: order,
          status: "draft",
        },
      },
      {
        onSuccess: (created) => {
          toast.success(hu.plan.toastSceneCreated);
          // Close the create→write loop: open the new scene in the editor.
          navTo(routes.scene(bookId, created.id));
        },
        onError: () => toast.error(hu.plan.errorSceneCreate),
        onSettled: () => {
          creatingRef.current = false;
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-px">
      <div className="group flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-7 flex-1 items-center gap-[7px] rounded-lg px-2 text-left text-[13px] font-medium text-text hover:bg-surface-muted"
        >
          <Icon icon={open ? ChevronDown : ChevronRight} size={13} />
          <span className="flex-1 truncate">{chapter.title}</span>
          <span className="text-[11px] tabular-nums text-text-muted">
            {chapter.scenes.length}
          </span>
        </button>
        <button
          type="button"
          aria-label={hu.plan.newScene}
          title={hu.plan.newScene}
          onClick={handleNewScene}
          disabled={createScene.isPending}
          className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-text-faint hover:bg-surface-muted hover:text-text disabled:opacity-50"
        >
          <Icon icon={Plus} size={13} />
        </button>
      </div>

      {open ? (
        chapter.scenes.length === 0 ? (
          <p className="m-0 px-2 py-1.5 pl-[34px] text-[12px] text-text-muted">
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
