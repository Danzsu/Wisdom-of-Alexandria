"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  useBookTree,
  findSceneLocation,
  type ChapterWithScenes,
} from "@/lib/api/hooks";
import type { SceneRead } from "@/lib/api/types";

export interface InspectorScene {
  scene: SceneRead | null;
  chapter: ChapterWithScenes | null;
  bookId: string | undefined;
  sceneId: string | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Resolve the active scene + its chapter for the inspector, from the same book
 * tree the Write View loads (TanStack Query dedupes the request). The inspector
 * is rendered by the shell, so it reads the route params directly.
 */
export function useInspectorScene(): InspectorScene {
  const params = useParams<{ bookId?: string; sceneId?: string }>();
  const bookId = params?.bookId;
  const sceneId = params?.sceneId;

  const tree = useBookTree(bookId);

  const location = useMemo(
    () =>
      sceneId && tree.chapters.length > 0
        ? findSceneLocation(tree.chapters, sceneId)
        : null,
    [tree.chapters, sceneId],
  );

  return {
    scene: location?.scene ?? null,
    chapter: location?.chapter ?? null,
    bookId,
    sceneId,
    isLoading: tree.isLoading,
    isError: tree.isError,
  };
}
