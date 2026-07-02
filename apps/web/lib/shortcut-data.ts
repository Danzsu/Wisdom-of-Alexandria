import { hu } from "@/lib/i18n/hu";

/** Shortcut group areas (Általános / Szerkesztő / AI). */
export type ShortcutGroupKey = "general" | "editor" | "ai";

export interface ShortcutEntry {
  /** Localized action description. */
  label: string;
  /**
   * Chord tokens. The literal "Mod" resolves to ⌘ (Mac) / Ctrl (else) at render
   * time via {@link formatChord}; other tokens render verbatim.
   */
  keys: string[];
}

export interface ShortcutGroup {
  key: ShortcutGroupKey;
  label: string;
  entries: ShortcutEntry[];
}

/**
 * The REAL shortcuts wired in the app, grouped by area. Sources:
 * - Cmd/Ctrl+K — command palette (CommandPaletteHotkey).
 * - `?` — this overlay (ShortcutsOverlayHotkey).
 * - Esc — close overlay / exit focus mode (Radix Dialog + AppShell).
 * - `/` — editor slash menu (SlashMenu).
 * - Mod+B / Mod+I — Tiptap StarterKit bold / italic.
 * - Mod+Z / Mod+Shift+Z — Tiptap StarterKit UndoRedo (history), also on the
 *   editor toolbar as buttons.
 * - AI rewrite / continue — surfaced via the toolbar + slash menu (no global
 *   keybinding yet); listed so the overlay is an honest index of AI actions.
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    key: "general",
    label: hu.shortcuts.groupGeneral,
    entries: [
      { label: hu.shortcuts.commandPalette, keys: ["Mod", "K"] },
      { label: hu.shortcuts.showShortcuts, keys: ["?"] },
      { label: hu.shortcuts.closeExitFocus, keys: ["Esc"] },
    ],
  },
  {
    key: "editor",
    label: hu.shortcuts.groupEditor,
    entries: [
      { label: hu.shortcuts.slashMenu, keys: ["/"] },
      { label: hu.shortcuts.bold, keys: ["Mod", "B"] },
      { label: hu.shortcuts.italic, keys: ["Mod", "I"] },
      { label: hu.shortcuts.undo, keys: ["Mod", "Z"] },
      { label: hu.shortcuts.redo, keys: ["Mod", "Shift", "Z"] },
    ],
  },
  {
    key: "ai",
    label: hu.shortcuts.groupAi,
    entries: [
      { label: hu.shortcuts.aiRewrite, keys: ["Átírás"] },
      { label: hu.shortcuts.aiContinue, keys: ["Folytatás"] },
    ],
  },
];
