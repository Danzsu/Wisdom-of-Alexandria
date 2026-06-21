import { create } from "zustand";

/**
 * Identifier of the single currently-open shell menu, or `null` when none is
 * open. Only one of these menus may be open at a time (the prototype's
 * single-open behaviour).
 */
export type MenuId = "user" | "tools" | "project";

/**
 * Identifier of the single open responsive shell drawer (UX-4a), or `null`.
 * Below the `lg` breakpoint the left structure pane (chapter tree / codex) and
 * the right AI inspector collapse into mutually-exclusive slide-in drawers; only
 * one may be open at a time so they never fight for the viewport.
 */
export type ShellDrawerId = "tree" | "inspector";

/** Auto-clear delay (ms) for the navigation sparkfield — matches `woaSpark`. */
export const SPARK_DURATION_MS = 1100;

interface UIState {
  /** The single open menu id, or null. Enforces single-open semantics. */
  openMenu: MenuId | null;
  /** Whether the command palette overlay is open. */
  commandOpen: boolean;
  /** Whether the keyboard-shortcuts help overlay is open. */
  shortcutsOpen: boolean;
  /** Whether the "Hogyan működik" onboarding scroll-narrative is open. */
  howItWorksOpen: boolean;
  /**
   * The single open responsive shell drawer (UX-4a), or `null` when none is
   * open. Mutually exclusive (one viewport, one drawer). Desktop (≥ lg) never
   * opens these — the panes are inline there — so the value stays `null`.
   */
  shellDrawer: ShellDrawerId | null;
  /** Transient flag driving the navigation sparkfield. */
  sparkActive: boolean;

  /** Open the given menu (closing any other), or pass null to close all. */
  setMenu: (menu: MenuId | null) => void;
  /** Toggle a menu: open it if closed, close it if it is the open one. */
  toggleMenu: (menu: MenuId) => void;
  /** Close every shell menu. */
  closeMenus: () => void;

  /** Open the command palette. */
  openCommand: () => void;
  /** Close the command palette. */
  closeCommand: () => void;
  /** Toggle the command palette open/closed. */
  toggleCommand: () => void;

  /** Open the keyboard-shortcuts overlay. */
  openShortcuts: () => void;
  /** Close the keyboard-shortcuts overlay. */
  closeShortcuts: () => void;

  /** Open the "Hogyan működik" onboarding narrative. */
  openHowItWorks: () => void;
  /** Close the "Hogyan működik" onboarding narrative. */
  closeHowItWorks: () => void;

  /** Open the given responsive shell drawer (closing any other drawer). */
  openShellDrawer: (drawer: ShellDrawerId) => void;
  /** Toggle a shell drawer: open it if closed, close it if it is the open one. */
  toggleShellDrawer: (drawer: ShellDrawerId) => void;
  /** Close any open shell drawer. */
  closeShellDrawer: () => void;

  /** Fire the sparkfield; it auto-clears after `SPARK_DURATION_MS`. */
  triggerSpark: () => void;
  /** Clear the sparkfield (called by the auto-clear timer / on unmount). */
  clearSpark: () => void;
}

/**
 * Pending auto-clear timer for the sparkfield. Kept at module scope (not in
 * the store) so a rapid sequence of `triggerSpark` calls debounces to a single
 * clear, and so the timer can be cancelled deterministically in `clearSpark`.
 */
let sparkTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Global client-side UI state for the app shell. Server data is intentionally
 * NOT kept here (none is needed in M2 — TanStack Query owns server state).
 */
export const useUIStore = create<UIState>((set, get) => ({
  openMenu: null,
  commandOpen: false,
  shortcutsOpen: false,
  howItWorksOpen: false,
  shellDrawer: null,
  sparkActive: false,

  setMenu: (menu) => set({ openMenu: menu }),
  toggleMenu: (menu) =>
    set((state) => ({ openMenu: state.openMenu === menu ? null : menu })),
  closeMenus: () => set({ openMenu: null }),

  openCommand: () => set({ commandOpen: true, openMenu: null }),
  closeCommand: () => set({ commandOpen: false }),
  toggleCommand: () =>
    set((state) => ({
      commandOpen: !state.commandOpen,
      openMenu: null,
    })),

  // Opening the shortcuts overlay closes any open menu / the command palette so
  // only one overlay is visible at a time.
  openShortcuts: () =>
    set({ shortcutsOpen: true, commandOpen: false, openMenu: null }),
  closeShortcuts: () => set({ shortcutsOpen: false }),

  // Opening the onboarding narrative closes the other single-instance overlays
  // so only one is visible at a time (same invariant as the shortcuts overlay).
  openHowItWorks: () =>
    set({
      howItWorksOpen: true,
      shortcutsOpen: false,
      commandOpen: false,
      openMenu: null,
    }),
  closeHowItWorks: () => set({ howItWorksOpen: false }),

  // The shell drawers are mutually exclusive (one viewport). Opening one always
  // closes any other, and closes the menus so a flyout doesn't linger behind it.
  openShellDrawer: (drawer) => set({ shellDrawer: drawer, openMenu: null }),
  toggleShellDrawer: (drawer) =>
    set((state) => ({
      shellDrawer: state.shellDrawer === drawer ? null : drawer,
      openMenu: null,
    })),
  closeShellDrawer: () => set({ shellDrawer: null }),

  triggerSpark: () => {
    if (sparkTimer !== null) {
      clearTimeout(sparkTimer);
      sparkTimer = null;
    }
    set({ sparkActive: true });
    sparkTimer = setTimeout(() => {
      sparkTimer = null;
      // Guard against clearing a spark that a later trigger re-armed: only the
      // most recent timer reaches here because earlier ones are cancelled above.
      get().clearSpark();
    }, SPARK_DURATION_MS);
  },
  clearSpark: () => {
    if (sparkTimer !== null) {
      clearTimeout(sparkTimer);
      sparkTimer = null;
    }
    set({ sparkActive: false });
  },
}));
