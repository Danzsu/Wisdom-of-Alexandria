/**
 * Regression tests for the M7 order_index collision on rapid creates.
 *
 * The backend create endpoints STORE the `order_index` they are sent (schema
 * default 0); they do NOT auto-append. The original board derived the new index
 * from a CAPTURED render value (`tree.chapters.length` / `chapter.scenes.length`),
 * so two creates fired before the invalidation refetch landed computed the SAME
 * index → a collision (ambiguous order until a reorder fixed it).
 *
 * The fix: every create entry point self-gates on a single in-flight pending
 * flag (a second create cannot fire while one is pending), and the append index
 * is read from the FRESHEST cache via `getQueryData` rather than a captured
 * length. These tests assert: (1) two rapid chapter creates do NOT both fire,
 * and (2) two rapid scene creates do NOT both fire — so no colliding
 * order_index is produced. They fail against the old captured-`.length`
 * behaviour (which fired both, posting the same index twice) and pass against
 * the gated implementation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { resetPlanStore } from "@/test/msw/handlers";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  nextChapterOrderIndex,
  nextSceneOrderIndex,
  queryKeys,
} from "@/lib/api/hooks";
import { CHAPTER_ONE, CHAPTER_TWO, FAROSZ_BOOK } from "@/test/msw/fixtures";
import { usePlanBoard } from "../use-plan-board";
import { QueryClient } from "@tanstack/react-query";
import type { ChapterRead, SceneRead } from "@/lib/api/types";

const base = `${API_BASE_URL}/api/v1`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/konyv/x/terv",
  useParams: () => ({ bookId: FAROSZ_BOOK.id }),
}));

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

describe("order_index collision guard (rapid creates)", () => {
  beforeEach(() => resetPlanStore());
  afterEach(() => vi.restoreAllMocks());

  it("two rapid chapter creates fire only ONE POST (second blocked while pending)", async () => {
    // Count chapter POSTs + record each posted order_index. With the old
    // captured-`.length` behaviour both creates fired with the SAME index
    // (collision). With the gate, the second never fires while the first is
    // pending.
    const postedOrderIndices: number[] = [];
    server.use(
      http.post(`${base}/books/:bookId/chapters`, async ({ request }) => {
        const body = (await request.json()) as { order_index: number };
        postedOrderIndices.push(body.order_index);
        // Never-resolving-ish: hold the response so the FIRST stays pending
        // across the second synchronous click (simulates the real refetch lag).
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json(
          {
            id: `chapter-created-${postedOrderIndices.length}`,
            book_id: FAROSZ_BOOK.id,
            title: "X",
            summary: null,
            order_index: body.order_index,
            status: "draft",
            created_at: "2026-06-14T18:00:00Z",
            updated_at: "2026-06-14T18:00:00Z",
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => usePlanBoard({ bookId: FAROSZ_BOOK.id, search: "" }), {
      wrapper: wrapperWith(new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity, staleTime: 0 },
          mutations: { retry: false },
        },
      })),
    });

    // Wait for the tree to load the two seeded chapters.
    await waitFor(() => expect(result.current.chapters.length).toBe(2));

    // Fire two creates back-to-back inside one act() — the second sees the
    // first's pending state and must be blocked by the self-gate.
    act(() => {
      result.current.createChapter();
      result.current.createChapter();
    });

    // Let the first settle.
    await waitFor(() => expect(result.current.isCreating).toBe(false));

    // Only ONE POST fired (the gate blocked the second). The old behaviour
    // fired TWO with a colliding order_index.
    expect(postedOrderIndices).toHaveLength(1);
    // And the one that fired appended past the two seeded chapters.
    expect(postedOrderIndices[0]).toBe(2);
  });

  it("two rapid scene creates in a chapter fire only ONE POST", async () => {
    const postedOrderIndices: number[] = [];
    server.use(
      http.post(
        `${base}/chapters/:chapterId/scenes`,
        async ({ request, params }) => {
          const body = (await request.json()) as { order_index: number };
          postedOrderIndices.push(body.order_index);
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json(
            {
              id: `scene-created-${postedOrderIndices.length}`,
              chapter_id: String(params.chapterId),
              title: "X",
              content: null,
              summary: null,
              order_index: body.order_index,
              status: "draft",
              word_count: 0,
              pov_character_id: null,
              created_at: "2026-06-14T18:00:00Z",
              updated_at: "2026-06-14T18:00:00Z",
            },
            { status: 201 },
          );
        },
      ),
    );

    const { result } = renderHook(() => usePlanBoard({ bookId: FAROSZ_BOOK.id, search: "" }), {
      wrapper: wrapperWith(new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity, staleTime: 0 },
          mutations: { retry: false },
        },
      })),
    });

    await waitFor(() => expect(result.current.chapters.length).toBe(2));

    act(() => {
      result.current.createScene(CHAPTER_ONE.id);
      result.current.createScene(CHAPTER_ONE.id);
    });

    await waitFor(() => expect(result.current.isCreating).toBe(false));

    expect(postedOrderIndices).toHaveLength(1);
    // CHAPTER_ONE seeds one scene (order_index 0) → append at 1.
    expect(postedOrderIndices[0]).toBe(1);
  });
});

describe("append-index helpers read the freshest cache (not a captured length)", () => {
  it("nextChapterOrderIndex returns max(order_index)+1 from the cached list", () => {
    const client = new QueryClient();
    // No cache yet → 0.
    expect(nextChapterOrderIndex(client, FAROSZ_BOOK.id)).toBe(0);

    // Seed a list whose ids would mislead a `.length` heuristic: gaps in the
    // order_index sequence. max(order_index)+1 must win, not the count.
    const cached: ChapterRead[] = [
      { ...CHAPTER_ONE, order_index: 0 },
      { ...CHAPTER_TWO, order_index: 5 },
    ];
    client.setQueryData(queryKeys.bookChapters(FAROSZ_BOOK.id), cached);
    // length would give 2 (a collision with the order_index=5 chapter's
    // neighbours); max+1 correctly gives 6.
    expect(nextChapterOrderIndex(client, FAROSZ_BOOK.id)).toBe(6);
  });

  it("nextSceneOrderIndex returns max(order_index)+1 from the cached scenes", () => {
    const client = new QueryClient();
    expect(nextSceneOrderIndex(client, CHAPTER_ONE.id)).toBe(0);

    const cached: SceneRead[] = [
      {
        id: "s1",
        chapter_id: CHAPTER_ONE.id,
        title: "a",
        content: null,
        summary: null,
        order_index: 3,
        status: "draft",
        word_count: 0,
        pov_character_id: null,
        location_id: null,
        created_at: "2026-06-14T14:32:00Z",
        updated_at: "2026-06-14T14:32:00Z",
      },
    ];
    client.setQueryData(queryKeys.chapterScenes(CHAPTER_ONE.id), cached);
    expect(nextSceneOrderIndex(client, CHAPTER_ONE.id)).toBe(4);
  });
});
