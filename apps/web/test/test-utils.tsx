/**
 * Shared test helpers: a `renderWithProviders` that mounts a fresh TanStack
 * Query client (retries off, so error paths resolve immediately) plus the
 * Toaster, and a `createTestQueryClient` for hook tests via `renderHook`.
 */
import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/kit/toast";
import { TooltipProvider } from "@/components/kit/tooltip";

/** A QueryClient tuned for tests: no retries, no caching between tests. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function Providers({
  children,
  client,
}: {
  children: ReactNode;
  client?: QueryClient;
}) {
  const queryClient = client ?? createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: { client?: QueryClient } & Omit<RenderOptions, "wrapper">,
) {
  const { client, ...rest } = options ?? {};
  return render(ui, {
    wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
    ...rest,
  });
}
