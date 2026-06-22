import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import {
  useDeleteImage,
  useEntityImages,
  useGenerateImage,
  useSetCanonical,
} from "@/lib/api/image-hooks";
import { resetImageStore } from "@/test/msw/handlers";
import { FAROSZ_PROJECT, makeMediaAsset } from "@/test/msw/fixtures";
import { Providers, createTestQueryClient } from "@/test/test-utils";

const aiBase = `${AI_BASE_URL}/api/v1`;
const ENTITY_TYPE = "character";
const ENTITY_ID = "codex-szelene";

/** A wrapper whose Providers share ONE QueryClient (so invalidations refetch). */
function wrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

describe("useEntityImages / useGenerateImage", () => {
  beforeEach(() => resetImageStore());

  it("is disabled until both entityType and entityId are present", async () => {
    const { result } = renderHook(
      () => useEntityImages(undefined, undefined),
      { wrapper: wrapper() },
    );
    // Disabled query never fetches.
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("useGenerateImage POSTs and the gallery reflects the new asset", async () => {
    const wrap = wrapper();
    const gallery = renderHook(
      () => useEntityImages(ENTITY_TYPE, ENTITY_ID),
      { wrapper: wrap },
    );
    await waitFor(() => expect(gallery.result.current.isSuccess).toBe(true));
    expect(gallery.result.current.data).toHaveLength(0);

    const gen = renderHook(() => useGenerateImage(), { wrapper: wrap });
    gen.result.current.mutate({
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
      projectId: FAROSZ_PROJECT.id,
      style: "realistic_portrait",
    });

    // The onSuccess invalidation refetches the gallery → the new asset appears.
    await waitFor(() =>
      expect(gallery.result.current.data?.length ?? 0).toBe(1),
    );
    expect(gallery.result.current.data?.[0]?.status).toBe("generating");
  });

  it("a generating asset triggers polling and flips to ready", async () => {
    // GET returns a GENERATING asset on the first call, then a READY one — the
    // hook must poll past the non-terminal state and surface ready.
    let calls = 0;
    server.use(
      http.get(`${aiBase}/ai/images`, () => {
        calls += 1;
        const status = calls < 2 ? "generating" : "ready";
        return HttpResponse.json([
          makeMediaAsset(status, { id: "media-poll" }),
        ]);
      }),
    );

    const { result } = renderHook(
      () => useEntityImages(ENTITY_TYPE, ENTITY_ID),
      { wrapper: wrapper() },
    );

    await waitFor(
      () => expect(result.current.data?.[0]?.status).toBe("ready"),
      { timeout: 5000 },
    );
    expect(calls).toBeGreaterThanOrEqual(2); // it did NOT stop at the first generating poll
  });

  it("stops polling once nothing is generating", async () => {
    // A single ready asset must not trigger repeated polls.
    let calls = 0;
    server.use(
      http.get(`${aiBase}/ai/images`, () => {
        calls += 1;
        return HttpResponse.json([makeMediaAsset("ready")]);
      }),
    );
    const { result } = renderHook(
      () => useEntityImages(ENTITY_TYPE, ENTITY_ID),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const after = calls;
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toBe(after); // no further polling
  });
});

describe("useSetCanonical / useDeleteImage", () => {
  beforeEach(() => resetImageStore());

  it("useSetCanonical invalidates so the gallery reflects the canonical flag", async () => {
    const wrap = wrapper();
    // Seed an asset via generate, then list.
    const gen = renderHook(() => useGenerateImage(), { wrapper: wrap });
    gen.result.current.mutate({
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
      projectId: FAROSZ_PROJECT.id,
      style: "realistic_portrait",
    });
    await waitFor(() => expect(gen.result.current.isSuccess).toBe(true));
    const assetId = gen.result.current.data!.id;

    const gallery = renderHook(
      () => useEntityImages(ENTITY_TYPE, ENTITY_ID),
      { wrapper: wrap },
    );
    await waitFor(() =>
      expect(gallery.result.current.data?.length ?? 0).toBe(1),
    );
    expect(gallery.result.current.data?.[0]?.is_canonical).toBe(false);

    const canonical = renderHook(() => useSetCanonical(), { wrapper: wrap });
    canonical.result.current.mutate({
      assetId,
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
    });

    await waitFor(() =>
      expect(gallery.result.current.data?.[0]?.is_canonical).toBe(true),
    );
  });

  it("useDeleteImage invalidates so the gallery drops the asset", async () => {
    const wrap = wrapper();
    const gen = renderHook(() => useGenerateImage(), { wrapper: wrap });
    gen.result.current.mutate({
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
      projectId: FAROSZ_PROJECT.id,
      style: "realistic_portrait",
    });
    await waitFor(() => expect(gen.result.current.isSuccess).toBe(true));
    const assetId = gen.result.current.data!.id;

    const gallery = renderHook(
      () => useEntityImages(ENTITY_TYPE, ENTITY_ID),
      { wrapper: wrap },
    );
    await waitFor(() =>
      expect(gallery.result.current.data?.length ?? 0).toBe(1),
    );

    const del = renderHook(() => useDeleteImage(), { wrapper: wrap });
    del.result.current.mutate({
      assetId,
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
    });

    await waitFor(() =>
      expect(gallery.result.current.data?.length ?? 0).toBe(0),
    );
  });
});
