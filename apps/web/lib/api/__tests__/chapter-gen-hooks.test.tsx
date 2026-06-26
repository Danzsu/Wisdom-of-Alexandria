/**
 * useChapterScenesForGeneration + useGenerateChapter (chapter automation, T4).
 *
 * The data hook is the selection list's source: it reuses the EXISTING endpoints
 * (`listScenes` + per-scene `listBeats`) — no new backend shape — and derives the
 * two facts the modal needs: `isEmpty` (no manuscript text) and `beatCount`. The
 * tests pin those derivations + the default-selection rule (empty AND beats).
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL, AI_BASE_URL } from "@/lib/api/client";
import {
  useChapterScenesForGeneration,
  useGenerateChapter,
} from "@/lib/api/ai-hooks";
import { Providers, createTestQueryClient } from "@/test/test-utils";
import type { BeatRead, SceneRead } from "@/lib/api/types";
import type { QueryClient } from "@tanstack/react-query";

const apiBase = `${API_BASE_URL}/api/v1`;
const aiBase = `${AI_BASE_URL}/api/v1`;
const CHAPTER_ID = "chap-hook-1";
const NOW = "2026-06-26T10:00:00Z";

function scene(id: string, partial: Partial<SceneRead>): SceneRead {
  return {
    id,
    chapter_id: CHAPTER_ID,
    title: id,
    content: null,
    summary: null,
    order_index: 0,
    status: "draft",
    word_count: 0,
    pov_character_id: null,
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

describe("useChapterScenesForGeneration", () => {
  it("derives isEmpty + beatCount + selectableByDefault from the existing endpoints", async () => {
    const sceneEmpty = scene("s-empty", { content: "", word_count: 0 });
    const sceneFull = scene("s-full", { content: "Van szöveg.", word_count: 12 });
    const sceneNoBeats = scene("s-nobeats", { content: "", word_count: 0 });

    server.use(
      http.get(`${apiBase}/chapters/${CHAPTER_ID}/scenes`, () =>
        HttpResponse.json([sceneEmpty, sceneFull, sceneNoBeats]),
      ),
      http.get(`${apiBase}/scenes/:sceneId/beats`, ({ params }) => {
        const sid = String(params.sceneId);
        if (sid === sceneEmpty.id)
          return HttpResponse.json([beat(sid, 0), beat(sid, 1)]);
        if (sid === sceneFull.id) return HttpResponse.json([beat(sid, 0)]);
        return HttpResponse.json([]); // no-beats scene
      }),
    );

    const { result } = renderHook(
      () => useChapterScenesForGeneration(CHAPTER_ID, true),
      { wrapper: wrapperWith(createTestQueryClient()) },
    );

    await waitFor(() => expect(result.current.scenes).toHaveLength(3));

    const byId = Object.fromEntries(
      result.current.scenes.map((s) => [s.id, s]),
    );

    // empty + 2 beats → empty, beatCount 2, selectable by default.
    expect(byId[sceneEmpty.id]).toMatchObject({
      isEmpty: true,
      beatCount: 2,
      selectableByDefault: true,
    });
    // non-empty + 1 beat → NOT empty, NOT selectable by default.
    expect(byId[sceneFull.id]).toMatchObject({
      isEmpty: false,
      beatCount: 1,
      selectableByDefault: false,
    });
    // empty + 0 beats → empty but NOT selectable (no beats).
    expect(byId[sceneNoBeats.id]).toMatchObject({
      isEmpty: true,
      beatCount: 0,
      selectableByDefault: false,
    });
  });

  it("does NOT fetch while disabled (modal closed)", async () => {
    let fetched = false;
    server.use(
      http.get(`${apiBase}/chapters/${CHAPTER_ID}/scenes`, () => {
        fetched = true;
        return HttpResponse.json([]);
      }),
    );
    renderHook(() => useChapterScenesForGeneration(CHAPTER_ID, false), {
      wrapper: wrapperWith(createTestQueryClient()),
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetched).toBe(false);
  });
});

describe("useGenerateChapter", () => {
  it("POSTs to the AI-service chapter-generate endpoint and resolves the queued job", async () => {
    let capturedBody: { scene_ids?: string[]; run_continuity?: boolean } = {};
    server.use(
      http.post(`${aiBase}/ai/chapters/${CHAPTER_ID}/generate`, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json(
          {
            id: "job-1",
            project_id: null,
            scene_id: null,
            chapter_id: CHAPTER_ID,
            job_type: "chapter_generate",
            status: "pending",
            model_name: null,
            prompt_version: null,
            input_data: { scene_ids: capturedBody.scene_ids },
            output_data: null,
            error_message: null,
            created_at: NOW,
            updated_at: NOW,
          },
          { status: 202 },
        );
      }),
    );

    const { result } = renderHook(() => useGenerateChapter(), {
      wrapper: wrapperWith(createTestQueryClient()),
    });

    result.current.mutate({
      chapterId: CHAPTER_ID,
      body: { scene_ids: ["s-empty", "s-full"], run_continuity: true },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("pending");
    expect(result.current.data?.job_type).toBe("chapter_generate");
    expect(new Set(capturedBody.scene_ids)).toEqual(
      new Set(["s-empty", "s-full"]),
    );
    expect(capturedBody.run_continuity).toBe(true);
  });
});
