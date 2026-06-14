"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "./stores/ui-store";

/**
 * Navigation helper used across the shell: push a route, fire the sparkfield,
 * and close any open menu/overlay.
 *
 * Returns a stable callback. `router.push` returns void in the App Router (it
 * is not a promise), so there is no floating promise to handle here.
 */
export function useNavTo() {
  const router = useRouter();
  const triggerSpark = useUIStore((s) => s.triggerSpark);
  const closeMenus = useUIStore((s) => s.closeMenus);
  const closeCommand = useUIStore((s) => s.closeCommand);

  return useCallback(
    (href: string) => {
      closeMenus();
      closeCommand();
      triggerSpark();
      router.push(href);
    },
    [router, triggerSpark, closeMenus, closeCommand],
  );
}
