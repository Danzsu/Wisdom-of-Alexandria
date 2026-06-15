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
  useMoveScene,
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

describe("useMoveScene — cross-chapter optimistic + rollback (P1.5)", () => {
  it("optimistically removes from the source + inserts into the target, then persists", async () => {
    const client = createTestQueryClient();
    // Source chapter (ch1) has [a, b]; target chapter (ch2) has [x].
    const sourceSeed: SceneRead[] = [
      { ...SCENE_FIRST, id: "a", chapter_id: CHAPTER_ONE.id, order_index: 0 },
      { ...SCENE_FIRST, id: "b", chapter_id: CHAPTER_ONE.id, order_index: 1 },
    ];
    const targetSeed: SceneRead[] = [
      { ...SCENE_ACTIVE, id: "x", chapter_id: CHAPTER_TWO.id, order_index: 0 },
    ];
    client.setQueryData(queryKeys.chapterScenes(CHAPTER_ONE.id), sourceSeed);
    client.setQueryData(queryKeys.chapterScenes(CHAPTER_TWO.id), targetSeed);

    // The move endpoint echoes the moved scene (now in the target chapter).
    server.use(
      http.post(`${base}/scenes/:sceneId/move`, async ({ request }) => {
        const body = (await request.json()) as {
          chapter_id: string;
          order_index: number;
        };
        return HttpResponse.json({
          ...sourceSeed[0],
          id: "a",
          chapter_id: body.chapter_id,
          order_index: body.order_index,
        });
      }),
      // onSettled invalidates BOTH lists; return the post-move server state.
      http.get(`${base}/chapters/:chapterId/scenes`, ({ params }) => {
        if (params.chapterId === CHAPTER_ONE.id) {
          return HttpResponse.json([{ ...sourceSeed[1], order_index: 0 }]);
        }
        return HttpResponse.json([
          { ...targetSeed[0], order_index: 0 },
          { ...sourceSeed[0], chapter_id: CHAPTER_TWO.id, order_index: 1 },
        ]);
      }),
    );

    const { result } = renderHook(() => useMoveScene(), {
      wrapper: wrapperWith(client),
    });

    // Move "a" into ch2 at index 1 (after "x").
    result.current.mutate({
      sceneId: "a",
      fromChapterId: CHAPTER_ONE.id,
      toChapterId: CHAPTER_TWO.id,
      targetIndex: 1,
    });

    // Optimistic write (synchronous in onMutate): source loses "a" + renumbers,
    // target gains "a" at index 1 with its chapter_id rewritten + renumbers.
    await waitFor(() => {
      const source = client.getQueryData<SceneRead[]>(
        queryKeys.chapterScenes(CHAPTER_ONE.id),
      );
      const target = client.getQueryData<SceneRead[]>(
        queryKeys.chapterScenes(CHAPTER_TWO.id),
      );
      expect(source?.map((s) => s.id)).toEqual(["b"]);
      expect(source?.[0].order_index).toBe(0); // gap closed densely
      expect(target?.map((s) => s.id)).toEqual(["x", "a"]);
      // The moved scene is attributed to the target chapter + densely renumbered.
      const moved = target?.find((s) => s.id === "a");
      expect(moved?.chapter_id).toBe(CHAPTER_TWO.id);
      expect(moved?.order_index).toBe(1);
      // No duplication: "a" appears in exactly one list.
      expect(source?.some((s) => s.id === "a")).toBe(false);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls BOTH chapter lists back when the server errors", async () => {
    const client = createTestQueryClient();
    const sourceSeed: SceneRead[] = [
      { ...SCENE_FIRST, id: "a", chapter_id: CHAPTER_ONE.id, order_index: 0 },
      { ...SCENE_FIRST, id: "b", chapter_id: CHAPTER_ONE.id, order_index: 1 },
    ];
    const targetSeed: SceneRead[] = [
      { ...SCENE_ACTIVE, id: "x", chapter_id: CHAPTER_TWO.id, order_index: 0 },
    ];
    client.setQueryData(queryKeys.chapterScenes(CHAPTER_ONE.id), sourceSeed);
    client.setQueryData(queryKeys.chapterScenes(CHAPTER_TWO.id), targetSeed);

    server.use(
      http.post(`${base}/scenes/:sceneId/move`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 400 }),
      ),
      // onSettled refetch returns the ORIGINAL (unmoved) lists.
      http.get(`${base}/chapters/:chapterId/scenes`, ({ params }) =>
        HttpResponse.json(
          params.chapterId === CHAPTER_ONE.id ? sourceSeed : targetSeed,
        ),
      ),
    );

    const { result } = renderHook(() => useMoveScene(), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate({
      sceneId: "a",
      fromChapterId: CHAPTER_ONE.id,
      toChapterId: CHAPTER_TWO.id,
      targetIndex: 1,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");

    // After rollback (+ settled refetch) BOTH lists are the originals again —
    // the scene is back in ch1 and not duplicated in ch2.
    await waitFor(() => {
      const source = client.getQueryData<SceneRead[]>(
        queryKeys.chapterScenes(CHAPTER_ONE.id),
      );
      const target = client.getQueryData<SceneRead[]>(
        queryKeys.chapterScenes(CHAPTER_TWO.id),
      );
      expect(source?.map((s) => s.id)).toEqual(["a", "b"]);
      expect(target?.map((s) => s.id)).toEqual(["x"]);
    });
  });

  // Regression for the same-chapter clarity work (A10.4): when
  // fromChapterId === toChapterId the two snapshots (previousFrom/previousTo)
  // are the SAME cached list and the two restore-writes target the one key. This
  // pins that a same-chapter move still rolls back to the original order on a
  // server error (idempotent double-restore is correct, not a regression).
  it("rolls a SAME-chapter move back to the original order when the server errors", async () => {
    const client = createTestQueryClient();
    // One chapter (ch2) holds [a, b, c]; move "c" to the front (index 0) within
    // the same chapter — fromChapterId === toChapterId.
    const seed: SceneRead[] = [
      { ...SCENE_ACTIVE, id: "a", chapter_id: CHAPTER_TWO.id, order_index: 0 },
      { ...SCENE_ACTIVE, id: "b", chapter_id: CHAPTER_TWO.id, order_index: 1 },
      { ...SCENE_ACTIVE, id: "c", chapter_id: CHAPTER_TWO.id, order_index: 2 },
    ];
    client.setQueryData(queryKeys.chapterScenes(CHAPTER_TWO.id), seed);

    server.use(
      http.post(`${base}/scenes/:sceneId/move`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 400 }),
      ),
      // onSettled invalidates the (single) list; return the ORIGINAL order so the
      // post-rollback cache is the original sequence.
      http.get(`${base}/chapters/:chapterId/scenes`, () =>
        HttpResponse.json(seed),
      ),
    );

    const { result } = renderHook(() => useMoveScene(), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate({
      sceneId: "c",
      fromChapterId: CHAPTER_TWO.id,
      toChapterId: CHAPTER_TWO.id,
      targetIndex: 0,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");

    // After the idempotent same-key rollback (+ the settled refetch) the order is
    // the original again, with no duplicate or dropped scene — proving the
    // same-chapter path (where previousFrom/previousTo are the SAME snapshot and
    // restore the one key twice) rolls back correctly.
    await waitFor(() => {
      const cached = client.getQueryData<SceneRead[]>(
        queryKeys.chapterScenes(CHAPTER_TWO.id),
      );
      expect(cached?.map((s) => s.id)).toEqual(["a", "b", "c"]);
    });
  });

  it("fires the move mutation with the right body (chapter_id + order_index)", async () => {
    let captured: { chapter_id: string; order_index: number } | null = null;
    server.use(
      http.post(`${base}/scenes/:sceneId/move`, async ({ request }) => {
        captured = (await request.json()) as {
          chapter_id: string;
          order_index: number;
        };
        return HttpResponse.json({
          ...SCENE_FIRST,
          chapter_id: CHAPTER_TWO.id,
          order_index: captured.order_index,
        });
      }),
    );
    const { result } = renderHook(() => useMoveScene(), {
      wrapper: wrapperWith(createTestQueryClient()),
    });
    result.current.mutate({
      sceneId: SCENE_FIRST.id,
      fromChapterId: CHAPTER_ONE.id,
      toChapterId: CHAPTER_TWO.id,
      targetIndex: 2,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captured).toEqual({ chapter_id: CHAPTER_TWO.id, order_index: 2 });
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
