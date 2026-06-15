import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import {
  useCreateProvider,
  useDeleteProvider,
  useProviders,
  useTestProvider,
  useUpdateProvider,
} from "@/lib/api/providers-hooks";
import { resetProviderStore } from "@/test/msw/handlers";
import { PROVIDER_GEMINI, PROVIDERS_FIXTURE } from "@/test/msw/fixtures";
import { Providers, createTestQueryClient } from "@/test/test-utils";

const base = `${API_BASE_URL}/api/v1`;

function wrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

describe("useProviders", () => {
  beforeEach(() => resetProviderStore());

  it("returns the masked provider list", async () => {
    const { result } = renderHook(() => useProviders(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(PROVIDERS_FIXTURE.length);
    const gemini = result.current.data?.find((p) => p.id === PROVIDER_GEMINI.id);
    expect(gemini?.api_key_masked).toBe("••••3f8a");
  });

  it("surfaces an error (not swallowed)", async () => {
    server.use(
      http.get(`${base}/providers`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useProviders(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");
  });
});

describe("provider mutations", () => {
  beforeEach(() => resetProviderStore());

  it("useCreateProvider creates + invalidates so the shared list refetch grows", async () => {
    const wrap = wrapper();
    const list = renderHook(() => useProviders(), { wrapper: wrap });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const before = list.result.current.data?.length ?? 0;

    // Same wrapper ⇒ same QueryClient, so the create's invalidation refetches
    // the list hook above.
    const create = renderHook(() => useCreateProvider(), { wrapper: wrap });
    create.result.current.mutate({
      type: "anthropic",
      label: "Claude",
      api_key: "sk-ant-9999",
    });
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true));
    // The created read carries only a mask — never the raw key.
    expect(create.result.current.data?.api_key_masked).toBe("••••9999");
    expect(create.result.current.data).not.toHaveProperty("api_key");
    // The shared list grew via invalidation.
    await waitFor(() =>
      expect(list.result.current.data?.length ?? 0).toBe(before + 1),
    );
  });

  it("useUpdateProvider patches a provider", async () => {
    const { result } = renderHook(() => useUpdateProvider(), {
      wrapper: wrapper(),
    });
    result.current.mutate({
      providerId: PROVIDER_GEMINI.id,
      patch: { label: "Renamed" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.label).toBe("Renamed");
  });

  it("useDeleteProvider deletes a provider", async () => {
    const { result } = renderHook(() => useDeleteProvider(), {
      wrapper: wrapper(),
    });
    result.current.mutate(PROVIDER_GEMINI.id);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useTestProvider returns ok/detail", async () => {
    const { result } = renderHook(() => useTestProvider(), {
      wrapper: wrapper(),
    });
    result.current.mutate(PROVIDER_GEMINI.id);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ok).toBe(true);
  });
});
