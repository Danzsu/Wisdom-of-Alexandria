import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { useRebuildIndex } from "@/lib/api/ai-hooks";
import { FAROSZ_PROJECT, makeIndexJob } from "@/test/msw/fixtures";
import { Providers } from "@/test/test-utils";
import {
  QueryClient,
  type QueryClient as QueryClientType,
} from "@tanstack/react-query";

const aiBase = `${AI_BASE_URL}/api/v1`;

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

describe("useRebuildIndex", () => {
  it("enqueues then polls to DONE, exposing the index counts", async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useRebuildIndex(FAROSZ_PROJECT.id), {
      wrapper: wrapperWith(client),
    });

    // Idle before the first trigger.
    expect(result.current.job).toBeNull();
    expect(result.current.isRunning).toBe(false);

    act(() => result.current.trigger());

    await waitFor(() => expect(result.current.job?.status).toBe("done"));
    expect(result.current.isRunning).toBe(false);
    // The counts the worker wrote into output_data reach the card.
    expect(result.current.job?.output_data).toMatchObject({
      indexed: 3,
      skipped: 2,
    });
  });

  it("keeps polling past a non-terminal status until the job finishes", async () => {
    // GET returns RUNNING first, then DONE — proves the hook polls past a
    // non-terminal state instead of stopping at the first response (mutation
    // guard for the refetchInterval terminal check).
    let calls = 0;
    server.use(
      http.post(`${aiBase}/ai/index/async`, () =>
        HttpResponse.json(makeIndexJob("pending"), { status: 202 }),
      ),
      http.get(`${aiBase}/jobs/:jobId`, ({ params }) => {
        calls += 1;
        const status = calls < 2 ? "running" : "done";
        return HttpResponse.json(
          makeIndexJob(
            status,
            status === "done"
              ? {
                  indexed: 1,
                  updated: 0,
                  deleted: 0,
                  skipped: 0,
                  skipped_no_provider: false,
                }
              : null,
            String(params.jobId),
          ),
        );
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useRebuildIndex(FAROSZ_PROJECT.id), {
      wrapper: wrapperWith(client),
    });
    act(() => result.current.trigger());

    await waitFor(() => expect(result.current.job?.status).toBe("done"), {
      timeout: 5000,
    });
    expect(calls).toBeGreaterThanOrEqual(2); // it did NOT stop at the first running poll
  });

  it("surfaces a FAILED job without throwing (error state, not crash)", async () => {
    server.use(
      http.post(`${aiBase}/ai/index/async`, () =>
        HttpResponse.json(makeIndexJob("pending"), { status: 202 }),
      ),
      http.get(`${aiBase}/jobs/:jobId`, ({ params }) =>
        HttpResponse.json(makeIndexJob("failed", null, String(params.jobId))),
      ),
    );
    const client = createTestQueryClient();
    const { result } = renderHook(() => useRebuildIndex(FAROSZ_PROJECT.id), {
      wrapper: wrapperWith(client),
    });
    act(() => result.current.trigger());

    await waitFor(() => expect(result.current.job?.status).toBe("failed"));
    expect(result.current.isRunning).toBe(false);
  });

  it("isRunning flips back to true on a SECOND trigger after a finished run", async () => {
    // First run resolves to done; a second trigger must NOT read isRunning=false
    // off the stale terminal job — the in-flight enqueue/poll must show running.
    let phase: "first" | "second" = "first";
    server.use(
      http.post(`${aiBase}/ai/index/async`, () =>
        HttpResponse.json(makeIndexJob("pending"), { status: 202 }),
      ),
      http.get(`${aiBase}/jobs/:jobId`, ({ params }) => {
        const status = phase === "first" ? "done" : "running";
        return HttpResponse.json(
          makeIndexJob(
            status,
            status === "done"
              ? {
                  indexed: 1,
                  updated: 0,
                  deleted: 0,
                  skipped: 0,
                  skipped_no_provider: false,
                }
              : null,
            String(params.jobId),
          ),
        );
      }),
    );
    const client = createTestQueryClient();
    const { result } = renderHook(() => useRebuildIndex(FAROSZ_PROJECT.id), {
      wrapper: wrapperWith(client),
    });

    act(() => result.current.trigger());
    await waitFor(() => expect(result.current.job?.status).toBe("done"));
    expect(result.current.isRunning).toBe(false);

    // Second run: GET now returns running — isRunning must become true again
    // (the bug would leave it stuck false from the prior terminal job).
    phase = "second";
    act(() => result.current.trigger());
    await waitFor(() => expect(result.current.isRunning).toBe(true));
  });

  it("trigger is a no-op without a project id (button stays inert)", async () => {
    let posted = false;
    server.use(
      http.post(`${aiBase}/ai/index/async`, () => {
        posted = true;
        return HttpResponse.json(makeIndexJob("pending"), { status: 202 });
      }),
    );
    const client = createTestQueryClient();
    const { result } = renderHook(() => useRebuildIndex(undefined), {
      wrapper: wrapperWith(client),
    });
    act(() => result.current.trigger());
    await new Promise((r) => setTimeout(r, 20));

    expect(posted).toBe(false); // never enqueued
    expect(result.current.job).toBeNull();
  });
});
