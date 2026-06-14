import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import {
  queryKeys,
  useArchiveScene,
  useBookChapters,
  useChapterScenes,
  useCreateChapter,
  useCreateScene,
  useDeleteScene,
  useReorderChapters,
  useReorderScenes,
} from "@/lib/api/hooks";
import {
  CHAPTER_ONE,
  CHAPTER_TWO,
  FAROSZ_BOOK,
  SCENE_ACTIVE,
  SCENE_FIRST,
} from "@/test/msw/fixtures";
import { Providers } from "@/test/test-utils";
import { QueryClient, type QueryClient as QueryClientType } from "@tanstack/react-query";
import type { ChapterRead, SceneRead } from "@/lib/api/types";

const base = `${API_BASE_URL}/api/v1`;

/**
 * A test client tuned for the OPTIMISTIC-cache assertions: like the shared
 * helper (retries off) but with `gcTime: Infinity` so a cache entry written by a
 * mutation's `onMutate` is not garbage-collected before we assert it (these
 * tests intentionally write to cache keys that no rendered component observes;
 * in production the board observes them so default gc is fine).
 */
function createTestQueryClient(): QueryClientType {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapperWith(client: QueryClientType) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

describe("useCreateChapter", () => {
  it("POSTs a chapter and a fresh list reflects it (stateful store)", async () => {
    const client = createTestQueryClient();

    const { result } = renderHook(() => useCreateChapter(), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate({
      bookId: FAROSZ_BOOK.id,
      data: { title: "III. fejezet — Tűz", order_index: 2, status: "draft" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe("III. fejezet — Tűz");

    // A fresh fetch of the book's chapters now includes the created chapter —
    // proving the POST persisted to the stateful store.
    const { result: list } = renderHook(
      () => useBookChapters(FAROSZ_BOOK.id),
      { wrapper: wrapperWith(client) },
    );
    await waitFor(() => expect(list.current.isSuccess).toBe(true));
    expect(
      list.current.data?.some((c) => c.title === "III. fejezet — Tűz"),
    ).toBe(true);
  });

  it("surfaces a create error (not swallowed)", async () => {
    server.use(
      http.post(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "nope" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useCreateChapter(), {
      wrapper: wrapperWith(createTestQueryClient()),
    });
    result.current.mutate({
      bookId: FAROSZ_BOOK.id,
      data: { title: "X", order_index: 0, status: "draft" },
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("nope");
  });
});

describe("useCreateScene", () => {
  it("POSTs a scene under a chapter and returns it", async () => {
    const { result } = renderHook(() => useCreateScene(), {
      wrapper: wrapperWith(createTestQueryClient()),
    });
    result.current.mutate({
      chapterId: CHAPTER_ONE.id,
      data: { title: "Új jelenet", order_index: 1, status: "draft" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.chapter_id).toBe(CHAPTER_ONE.id);
    expect(result.current.data?.title).toBe("Új jelenet");
  });
});

describe("useReorderScenes — optimistic + rollback", () => {
  it("optimistically reorders the cached scene list, then persists", async () => {
    const client = createTestQueryClient();
    // Seed the chapter-two scenes cache (it has one scene; add a second so the
    // order has something to swap). We assert the optimistic cache write.
    const seeded: SceneRead[] = [
      { ...SCENE_ACTIVE, id: "sa", order_index: 0 },
      { ...SCENE_ACTIVE, id: "sb", order_index: 1 },
    ];
    client.setQueryData(queryKeys.chapterScenes(CHAPTER_TWO.id), seeded);

    // The reorder endpoint echoes the store's order; stub it to return the
    // posted order so onSettled's refetch stays consistent.
    server.use(
      http.post(
        `${base}/chapters/:chapterId/scenes/reorder`,
        async ({ request }) => {
          const body = (await request.json()) as { order: string[] };
          const reordered = body.order.map((id, idx) => ({
            ...seeded.find((s) => s.id === id)!,
            order_index: idx,
          }));
          return HttpResponse.json(reordered);
        },
      ),
    );

    const { result } = renderHook(() => useReorderScenes(), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate({ chapterId: CHAPTER_TWO.id, order: ["sb", "sa"] });

    // Optimistic write happens synchronously inside onMutate.
    await waitFor(() => {
      const cached = client.getQueryData<SceneRead[]>(
        queryKeys.chapterScenes(CHAPTER_TWO.id),
      );
      expect(cached?.map((s) => s.id)).toEqual(["sb", "sa"]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("fires the reorder mutation with the new order payload", async () => {
    let captured: string[] | null = null;
    server.use(
      http.post(
        `${base}/chapters/:chapterId/scenes/reorder`,
        async ({ request }) => {
          const body = (await request.json()) as { order: string[] };
          captured = body.order;
          return HttpResponse.json([]);
        },
      ),
    );
    const { result } = renderHook(() => useReorderScenes(), {
      wrapper: wrapperWith(createTestQueryClient()),
    });
    result.current.mutate({
      chapterId: CHAPTER_ONE.id,
      order: [SCENE_FIRST.id, "other"],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured).toEqual([SCENE_FIRST.id, "other"]);
  });

  it("rolls back the optimistic order when the server errors", async () => {
    const client = createTestQueryClient();
    const original: SceneRead[] = [
      { ...SCENE_ACTIVE, id: "sa", order_index: 0 },
      { ...SCENE_ACTIVE, id: "sb", order_index: 1 },
    ];
    client.setQueryData(queryKeys.chapterScenes(CHAPTER_TWO.id), original);

    server.use(
      http.post(`${base}/chapters/:chapterId/scenes/reorder`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
      // onSettled invalidates → refetch the chapter scenes; return the original
      // order so the post-rollback cache is the original sequence.
      http.get(`${base}/chapters/:chapterId/scenes`, () =>
        HttpResponse.json(original),
      ),
    );

    const { result } = renderHook(() => useReorderScenes(), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate({ chapterId: CHAPTER_TWO.id, order: ["sb", "sa"] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");

    // After rollback (+ the settled refetch) the order is the original again.
    await waitFor(() => {
      const cached = client.getQueryData<SceneRead[]>(
        queryKeys.chapterScenes(CHAPTER_TWO.id),
      );
      expect(cached?.map((s) => s.id)).toEqual(["sa", "sb"]);
    });
  });
});

describe("useReorderChapters — optimistic", () => {
  it("optimistically reorders the cached chapter list, then persists", async () => {
    const client = createTestQueryClient();
    await client.fetchQuery({
      queryKey: queryKeys.bookChapters(FAROSZ_BOOK.id),
      queryFn: () =>
        fetch(`${base}/books/${FAROSZ_BOOK.id}/chapters`).then((r) => r.json()),
    });

    const { result } = renderHook(() => useReorderChapters(), {
      wrapper: wrapperWith(client),
    });

    // Swap the two seeded chapters.
    result.current.mutate({
      bookId: FAROSZ_BOOK.id,
      order: [CHAPTER_TWO.id, CHAPTER_ONE.id],
    });

    await waitFor(() => {
      const cached = client.getQueryData<ChapterRead[]>(
        queryKeys.bookChapters(FAROSZ_BOOK.id),
      );
      expect(cached?.map((c) => c.id)).toEqual([CHAPTER_TWO.id, CHAPTER_ONE.id]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useDeleteScene / useArchiveScene", () => {
  it("deletes a scene (DELETE) and resolves", async () => {
    const { result } = renderHook(() => useDeleteScene(), {
      wrapper: wrapperWith(createTestQueryClient()),
    });
    result.current.mutate({
      chapterId: CHAPTER_ONE.id,
      sceneId: SCENE_FIRST.id,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("archives a scene and returns status=archived", async () => {
    const { result } = renderHook(() => useArchiveScene(), {
      wrapper: wrapperWith(createTestQueryClient()),
    });
    result.current.mutate({
      chapterId: CHAPTER_TWO.id,
      sceneId: SCENE_ACTIVE.id,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("archived");
  });

  it("archived scenes drop out of the default scene list", async () => {
    const client = createTestQueryClient();
    const { result: archive } = renderHook(() => useArchiveScene(), {
      wrapper: wrapperWith(client),
    });
    archive.current.mutate({
      chapterId: CHAPTER_TWO.id,
      sceneId: SCENE_ACTIVE.id,
    });
    await waitFor(() => expect(archive.current.isSuccess).toBe(true));

    const { result: list } = renderHook(
      () => useChapterScenes(CHAPTER_TWO.id),
      { wrapper: wrapperWith(client) },
    );
    await waitFor(() => expect(list.current.isSuccess).toBe(true));
    expect(list.current.data?.some((s) => s.id === SCENE_ACTIVE.id)).toBe(false);
  });
});
