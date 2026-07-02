/**
 * useBookChaptersForGeneration + useGenerateBook + useCancelJob (book
 * automation, V2).
 *
 * The data hook is the "Könyv generálása" selection list's source: it reuses
 * the EXISTING endpoints (`listChapters` + per-chapter `listScenes` + per-scene
 * `listBeats`) — no new backend shape — and derives the one fact the modal
 * needs per chapter: `generatableCount` (EMPTY scenes with >=1 beat). The tests
 * pin that derivation + the default-selection rule, that the generate mutation
 * POSTs the EXACT body to the book's AI endpoint, and that cancel POSTs to the
 * EXACT job id.
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL, AI_BASE_URL } from "@/lib/api/client";
import {
  useBookChaptersForGeneration,
  useCancelJob,
  useGenerateBook,
} from "@/lib/api/ai-hooks";
import { Providers, createTestQueryClient } from "@/test/test-utils";
import type { BeatRead, ChapterRead, SceneRead } from "@/lib/api/types";
import type { QueryClient } from "@tanstack/react-query";

const apiBase = `${API_BASE_URL}/api/v1`;
const aiBase = `${AI_BASE_URL}/api/v1`;
const BOOK_ID = "book-hook-1";
const NOW = "2026-07-01T10:00:00Z";

function chapter(id: string, order: number): ChapterRead {
  return {
    id,
    book_id: BOOK_ID,
    title: id,
    summary: null,
    order_index: order,
    status: "draft",
    created_at: NOW,
    updated_at: NOW,
  };
}

function scene(id: string, chapterId: string, partial: Partial<SceneRead>): SceneRead {
  return {
    id,
    chapter_id: chapterId,
    title: id,
    content: null,
    summary: null,
    order_index: 0,
    status: "draft",
    word_count: 0,
    pov_character_id: null,
    location_id: null,
    created_at: NOW,
    updated_at: NOW,
    ...partial,
  };
}

function beat(sceneId: string, n: number): BeatRead {
  return {
    id: `${sceneId}-b${n}`,
    scene_id: sceneId,
    description: `b${n}`,
    beat_type: null,
    order_index: n,
    notes: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

describe("useBookChaptersForGeneration", () => {
  it("derives generatableCount + selectableByDefault from the existing endpoints", async () => {
    const chGen = chapter("ch-gen", 0);
    const chBlocked = chapter("ch-blocked", 1);
    const sEmpty = scene("s-empty", chGen.id, { content: "", word_count: 0 });
    const sFull = scene("s-full", chGen.id, {
      content: "Van szöveg.",
      word_count: 12,
    });
    const sNoBeats = scene("s-nobeats", chBlocked.id, {
      content: "",
      word_count: 0,
    });

    server.use(
      http.get(`${apiBase}/books/${BOOK_ID}/chapters`, () =>
        HttpResponse.json([chGen, chBlocked]),
      ),
      http.get(`${apiBase}/chapters/:chapterId/scenes`, ({ params }) =>
        HttpResponse.json(
          String(params.chapterId) === chGen.id ? [sEmpty, sFull] : [sNoBeats],
        ),
      ),
      http.get(`${apiBase}/scenes/:sceneId/beats`, ({ params }) => {
        const sid = String(params.sceneId);
        // s-empty: 2 beats; s-full: 1 beat; s-nobeats: none.
        if (sid === "s-empty")
          return HttpResponse.json([beat(sid, 0), beat(sid, 1)]);
        if (sid === "s-full") return HttpResponse.json([beat(sid, 0)]);
        return HttpResponse.json([]);
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useBookChaptersForGeneration(BOOK_ID, true),
      { wrapper: wrapperWith(client) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.chapters).toHaveLength(2));

    const [genRow, blockedRow] = result.current.chapters;
    // ch-gen: only the EMPTY scene with beats counts (the full scene has a
    // beat but text → NOT generatable by the safe default).
    expect(genRow).toMatchObject({
      id: "ch-gen",
      sceneCount: 2,
      generatableCount: 1,
      selectableByDefault: true,
    });
    // ch-blocked: its empty scene has no beats → 0 generatable → not default.
    expect(blockedRow).toMatchObject({
      id: "ch-blocked",
      sceneCount: 1,
      generatableCount: 0,
      selectableByDefault: false,
    });
  });

  it("does not fetch while disabled (closed dialog)", async () => {
    let chapterCalls = 0;
    server.use(
      http.get(`${apiBase}/books/${BOOK_ID}/chapters`, () => {
        chapterCalls += 1;
        return HttpResponse.json([]);
      }),
    );
    const client = createTestQueryClient();
    renderHook(() => useBookChaptersForGeneration(BOOK_ID, false), {
      wrapper: wrapperWith(client),
    });
    // Give any (incorrect) fetch a tick to fire.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(chapterCalls).toBe(0);
  });
});

describe("useGenerateBook", () => {
  it("POSTs the EXACT chapter_ids + run_continuity to the book's AI endpoint and resolves the queued job", async () => {
    let capturedUrl = "";
    let capturedBody: { chapter_ids?: string[]; run_continuity?: boolean } = {};
    server.use(
      http.post(`${aiBase}/ai/books/:bookId/generate`, async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json(
          {
            id: "job-hook-book-1",
            project_id: null,
            scene_id: null,
            chapter_id: null,
            book_id: BOOK_ID,
            job_type: "book_generate",
            status: "pending",
            model_name: null,
            prompt_version: null,
            input_data: {},
            output_data: null,
            error_message: null,
            created_at: NOW,
            updated_at: NOW,
          },
          { status: 202 },
        );
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useGenerateBook(), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate({
      bookId: BOOK_ID,
      body: { chapter_ids: ["ch-a", "ch-b"], run_continuity: true },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain(`/ai/books/${BOOK_ID}/generate`);
    expect(capturedBody.chapter_ids).toEqual(["ch-a", "ch-b"]);
    expect(capturedBody.run_continuity).toBe(true);
    // The queued parent job comes back drift-validated (book_id included).
    expect(result.current.data?.job_type).toBe("book_generate");
    expect(result.current.data?.status).toBe("pending");
    expect(result.current.data?.book_id).toBe(BOOK_ID);
  });
});

describe("useCancelJob", () => {
  it("POSTs to EXACTLY the given job's cancel endpoint and resolves the cancelled row", async () => {
    let cancelledJobId: string | null = null;
    server.use(
      http.post(`${aiBase}/jobs/:jobId/cancel`, ({ params }) => {
        cancelledJobId = String(params.jobId);
        return HttpResponse.json({
          id: cancelledJobId,
          project_id: null,
          scene_id: null,
          chapter_id: null,
          book_id: BOOK_ID,
          job_type: "book_generate",
          status: "cancelled",
          model_name: null,
          prompt_version: null,
          input_data: {},
          output_data: null,
          error_message: null,
          created_at: NOW,
          updated_at: NOW,
        });
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useCancelJob(), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate("job-cancel-me");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelledJobId).toBe("job-cancel-me");
    expect(result.current.data?.status).toBe("cancelled");
  });

  it("surfaces a 409 (already terminal) as an error — never swallowed", async () => {
    server.use(
      http.post(`${aiBase}/jobs/:jobId/cancel`, () =>
        HttpResponse.json(
          { detail: "Job is already done and cannot be cancelled" },
          { status: 409 },
        ),
      ),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useCancelJob(), {
      wrapper: wrapperWith(client),
    });

    result.current.mutate("job-done-already");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).not.toBeNull();
  });
});
