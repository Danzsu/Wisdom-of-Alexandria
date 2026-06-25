import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import {
  useBookChapters,
  useChapterScenes,
  useBookTree,
  useUpdateScene,
  useCodexEntries,
  findSceneLocation,
  type ChapterWithScenes,
} from "@/lib/api/hooks";
import {
  CHAPTER_ONE,
  CHAPTER_TWO,
  FAROSZ_BOOK,
  FAROSZ_PROJECT,
  SCENE_ACTIVE,
} from "@/test/msw/fixtures";
import { Providers, createTestQueryClient } from "@/test/test-utils";

const base = `${API_BASE_URL}/api/v1`;

function wrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

describe("useBookChapters", () => {
  it("returns the mocked chapter list", async () => {
    const { result } = renderHook(() => useBookChapters(FAROSZ_BOOK.id), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[1].title).toBe(CHAPTER_TWO.title);
  });

  it("surfaces an error (not swallowed)", async () => {
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "kaboom" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useBookChapters(FAROSZ_BOOK.id), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("kaboom");
  });

  it("is disabled without a book id", () => {
    const { result } = renderHook(() => useBookChapters(undefined), {
      wrapper: wrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useChapterScenes", () => {
  it("returns the scenes of a chapter", async () => {
    const { result } = renderHook(() => useChapterScenes(CHAPTER_TWO.id), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe(SCENE_ACTIVE.id);
  });
});

describe("useBookTree", () => {
  it("assembles chapters with their scenes", async () => {
    const { result } = renderHook(() => useBookTree(FAROSZ_BOOK.id), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.chapters).toHaveLength(2);
    expect(result.current.chapters[1].scenes[0].id).toBe(SCENE_ACTIVE.id);
  });

  it("surfaces a chapters error through the tree", async () => {
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "tree-fail" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useBookTree(FAROSZ_BOOK.id), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("tree-fail");
  });
});

describe("findSceneLocation", () => {
  const tree: ChapterWithScenes[] = [
    { ...CHAPTER_ONE, scenes: [] },
    { ...CHAPTER_TWO, scenes: [SCENE_ACTIVE] },
  ];

  it("locates a scene's chapter", () => {
    const loc = findSceneLocation(tree, SCENE_ACTIVE.id);
    expect(loc?.chapter.id).toBe(CHAPTER_TWO.id);
    expect(loc?.scene.title).toBe(SCENE_ACTIVE.title);
  });

  it("returns null for an unknown scene", () => {
    expect(findSceneLocation(tree, "nope")).toBeNull();
  });
});

describe("useUpdateScene", () => {
  it("patches content and recomputes word count", async () => {
    const { result } = renderHook(() => useUpdateScene(), { wrapper: wrapper() });
    result.current.mutate({
      chapterId: CHAPTER_TWO.id,
      sceneId: SCENE_ACTIVE.id,
      patch: { content: "egy kettő három négy öt" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.word_count).toBe(5);
  });

  it("PATCHes the nested chapter/scene path (chapterId + sceneId in URL)", async () => {
    let seenUrl: string | null = null;
    let seenMethod: string | null = null;
    server.use(
      http.patch(
        `${base}/chapters/:chapterId/scenes/:sceneId`,
        ({ request }) => {
          seenUrl = request.url;
          seenMethod = request.method;
          return HttpResponse.json({ ...SCENE_ACTIVE, content: "x", word_count: 1 });
        },
      ),
    );
    const { result } = renderHook(() => useUpdateScene(), { wrapper: wrapper() });
    result.current.mutate({
      chapterId: CHAPTER_TWO.id,
      sceneId: SCENE_ACTIVE.id,
      patch: { content: "x" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The mutation must hit the nested path with BOTH segments — dropping either
    // (e.g. building `/chapters//scenes/...`) breaks this. Assert the full path,
    // not just substrings, so a swapped/missing segment fails.
    expect(seenMethod).toBe("PATCH");
    expect(seenUrl).toBe(
      `${base}/chapters/${CHAPTER_TWO.id}/scenes/${SCENE_ACTIVE.id}`,
    );
  });

  it("surfaces a save error (not swallowed)", async () => {
    server.use(
      http.patch(`${base}/chapters/:chapterId/scenes/:sceneId`, () =>
        HttpResponse.json({ detail: "save-failed" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useUpdateScene(), { wrapper: wrapper() });
    result.current.mutate({
      chapterId: CHAPTER_TWO.id,
      sceneId: SCENE_ACTIVE.id,
      patch: { content: "x" },
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("save-failed");
  });
});

describe("useCodexEntries", () => {
  it("returns the project's codex entries", async () => {
    const { result } = renderHook(() => useCodexEntries(FAROSZ_PROJECT.id), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].title).toBe("Szelene");
  });
});
