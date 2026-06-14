import { QueryClient } from "@tanstack/react-query";

/**
 * Factory for the app's TanStack Query client.
 *
 * A factory (not a module singleton) keeps each browser session — and each
 * test — isolated, and avoids sharing cache between Next.js requests. M2 wires
 * the provider only; the actual queries arrive with the data milestones (M3+).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Sensible defaults for a local-first app: data is fresh briefly and
        // refetch-on-focus is off so the writer is never interrupted.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
