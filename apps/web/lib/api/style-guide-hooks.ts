"use client";

/**
 * TanStack Query hooks for the Stíluskalauz (Style Guide) screen.
 *
 * The screen is book-scoped in the URL but the StyleGuide is project-scoped on
 * the backend, so the book is resolved first (cached via `useResolvedBook`) and
 * its `project_id` keys the style-guide query.
 *
 * A missing style guide is a normal state (the API answers 404). The query is
 * configured NOT to retry on that — the 404 surfaces in `error` so the screen
 * can branch to the empty state instead of an error panel.
 */
import {
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { ApiError } from "./client";
import { getStyleGuide } from "./style-guide";
import type { StyleGuideRead } from "./types";

/** Query keys for the style-guide resource. */
export const styleGuideQueryKeys = {
  byProject: (projectId: string) =>
    ["projects", projectId, "style-guide"] as const,
};

/**
 * Fetch a project's style guide. Disabled until a project id is present.
 * Retries are suppressed for the 404 "no guide yet" case so it resolves quickly
 * to `error` (the screen reads `error.status === 404` → empty state).
 */
export function useStyleGuide(
  projectId: string | undefined,
): UseQueryResult<StyleGuideRead, ApiError> {
  return useQuery<StyleGuideRead, ApiError>({
    queryKey: styleGuideQueryKeys.byProject(projectId ?? "__none__"),
    queryFn: () => getStyleGuide(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 5 * 60_000,
    // Don't retry: a 404 (no guide yet) is a normal terminal state that maps to
    // the empty state, and a server error surfaces immediately via the error
    // panel's explicit "retry" button — no silent background retries either way.
    retry: false,
  });
}
