"use client";

/**
 * TanStack Query hooks for the Provider resource (P1.1 — provider/API-key
 * configuration). List + create / update / delete / test, plus a per-provider
 * model listing.
 *
 * Mutations invalidate the provider list (and the aggregated `GET /ai/models`
 * picker, which is now provider-aware) on success, and errors propagate via
 * Query's `error` / `isError` (never swallowed). Business/data logic lives here
 * + in `lib/api/providers.ts`; components only render state and fire callbacks.
 *
 * SECURITY: the cache holds only `ProviderRead` shapes (masked key + has_key);
 * the real plaintext key never enters the query cache.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  createProvider,
  deleteProvider,
  listProviderModels,
  listProviders,
  testProvider,
  updateProvider,
  type ProviderCreate,
  type ProviderModelsResponse,
  type ProviderRead,
  type ProviderTestResult,
  type ProviderUpdate,
} from "./providers";
import { aiQueryKeys } from "./ai-hooks";

/** Stable query-key factory for the provider resource. */
export const providerQueryKeys = {
  all: ["providers"] as const,
  list: (enabledOnly: boolean) => ["providers", { enabledOnly }] as const,
  models: (providerId: string) =>
    ["providers", providerId, "models"] as const,
};

/** List the configured providers. Pass `enabledOnly` to filter to enabled. */
export function useProviders(
  enabledOnly = false,
): UseQueryResult<ProviderRead[], Error> {
  return useQuery({
    queryKey: providerQueryKeys.list(enabledOnly),
    queryFn: () => listProviders(enabledOnly),
  });
}

/**
 * Invalidate every provider list (regardless of the `enabledOnly` flag) AND the
 * aggregated model picker, which now reflects provider config. Returns the
 * combined promise so a mutation stays pending until the caches settle.
 */
function invalidateProviderCaches(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: providerQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: aiQueryKeys.models }),
  ]).then(() => undefined);
}

/** Create a provider; invalidates the provider list + model picker on success. */
export function useCreateProvider(): UseMutationResult<
  ProviderRead,
  Error,
  ProviderCreate
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProviderCreate) => createProvider(input),
    onSuccess: () => invalidateProviderCaches(queryClient),
  });
}

/** Input for the provider-update mutation (id + patch). */
export interface UpdateProviderInput {
  providerId: string;
  patch: ProviderUpdate;
}

/**
 * Patch a provider; invalidates the provider list + model picker on success.
 * The caller OMITS `api_key` from `patch` to keep the stored key (sends it only
 * to replace it) — see `providerUpdateSchema`.
 */
export function useUpdateProvider(): UseMutationResult<
  ProviderRead,
  Error,
  UpdateProviderInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, patch }: UpdateProviderInput) =>
      updateProvider(providerId, patch),
    onSuccess: () => invalidateProviderCaches(queryClient),
  });
}

/** Delete a provider; invalidates the provider list + model picker on success. */
export function useDeleteProvider(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => deleteProvider(providerId),
    onSuccess: () => invalidateProviderCaches(queryClient),
  });
}

/**
 * Test a provider's connection/credentials. Returns `{ ok, detail }`; a
 * transport/HTTP error still rejects (surfaced via the mutation's `error`), so
 * the UI distinguishes "test ran and failed" (`ok: false`) from "the test call
 * itself errored".
 */
export function useTestProvider(): UseMutationResult<
  ProviderTestResult,
  Error,
  string
> {
  return useMutation({
    mutationFn: (providerId: string) => testProvider(providerId),
  });
}

/**
 * List the models a provider exposes. Disabled until a provider id is supplied
 * and (optionally) the caller opts in via `enabled` — model listing hits the
 * provider's API, so the Cloud subpage only fetches it for enabled providers.
 */
export function useProviderModels(
  providerId: string | undefined,
  enabled = true,
): UseQueryResult<ProviderModelsResponse, Error> {
  return useQuery({
    queryKey: providerQueryKeys.models(providerId ?? "__none__"),
    queryFn: () => listProviderModels(providerId as string),
    enabled: Boolean(providerId) && enabled,
    staleTime: 5 * 60_000,
  });
}
