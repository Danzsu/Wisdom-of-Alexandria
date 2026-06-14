"use client";

import { useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query-client";
import { TooltipProvider } from "@/components/kit/tooltip";
import { Toaster } from "@/components/kit/toast";

/**
 * Client-side provider stack for the app.
 *
 * Theming uses next-themes keyed on the `data-woa` attribute (not a `.dark`
 * class), matching the prototype and the Tailwind 4 `@custom-variant dark`.
 * The dark palette is fully defined, so both themes are first-class.
 *
 * Also mounts the cross-cutting singletons the kit relies on:
 * - QueryClientProvider (TanStack Query) — needed by later data milestones.
 * - TooltipProvider — required by every kit `Tooltip` (shared delay timer).
 * - Toaster — the sonner sink that `toast(...)` dispatches into.
 */
export function Providers({ children }: { children: ReactNode }) {
  // Create the client once per mount (lazy initial state), so it is stable
  // across re-renders but isolated per browser session / test.
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider
      attribute="data-woa"
      themes={["light", "dark"]}
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
