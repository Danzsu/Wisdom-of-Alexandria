"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * Global Cmd/Ctrl+K handler that toggles the command palette. Mounted once by
 * the shell. Kept as a tiny side-effect-only component so the palette itself
 * stays pure and easy to test.
 */
export function CommandPaletteHotkey() {
  const toggleCommand = useUIStore((s) => s.toggleCommand);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggleCommand();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCommand]);

  return null;
}
