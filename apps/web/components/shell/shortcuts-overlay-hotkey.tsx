"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * True when the event target is a text-entry context (input / textarea /
 * contenteditable, including the Tiptap editor). The `?` hotkey must NOT fire
 * there — the user is typing a literal "?", not asking for help.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // contenteditable covers the Tiptap manuscript editor surface. Prefer the
  // computed `isContentEditable`, but also honour the explicit attribute on the
  // target or an ancestor (jsdom doesn't compute the former, and the event
  // target may be a child node inside the editable region).
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable=""],[contenteditable="true"]') !== null;
}

/**
 * Global `?` (Shift+/) handler that opens the keyboard-shortcuts overlay.
 * Mounted once by the shell. Guards against firing while the user is typing in
 * an input / textarea / contenteditable (so "?" types normally there). Also
 * ignores the chord when a modifier other than Shift is held.
 */
export function ShortcutsOverlayHotkey() {
  const openShortcuts = useUIStore((s) => s.openShortcuts);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Only a bare "?" (Shift+/). Ignore when Ctrl/Meta/Alt are held so it
      // never collides with other chords.
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      openShortcuts();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openShortcuts]);

  return null;
}
