import { create } from "zustand";

/**
 * Editor-only client state for the Write View (M4).
 *
 * This store holds the editor *settings* (the live, Format-menu-driven
 * manuscript styling), the editor *modes* (focus / clean-write), the transient
 * autosave save-state machine, the live word count, and the inline scene-beat
 * card state machine. Server data (the scene content, chapters) lives in
 * TanStack Query — never here. The split lets the StatusBar (rendered by the
 * shell layout) read word count + save state without prop-drilling through the
 * route boundary, while the editor (rendered by the page) writes them.
 *
 * Defaults mirror the prototype exactly (Alexandria App.dc.html script state):
 *   fmFont 'Literata', fmSize '17', fmWidth 'normal', fmSpacing '1.75',
 *   docIndent false, beat 'hidden', beatWords '400'.
 */

/** Manuscript font choice (maps to a concrete font stack on the article). */
export type EditorFont = "Literata" | "Source Sans 3" | "system";
/** Column width preset → article max-width. */
export type EditorWidth = "narrow" | "normal" | "wide";
/** Line-height preset (stored as the literal multiplier the prototype uses). */
export type EditorSpacing = "1.5" | "1.75" | "2.1";

/** Autosave lifecycle, surfaced in the StatusBar + AI toolbar. */
export type SaveState = "idle" | "saving" | "saved" | "error";

/** Inline scene-beat card lifecycle (hidden→config→generating→ready→applied). */
export type BeatState =
  | "hidden"
  | "config"
  | "generating"
  | "ready"
  | "applied";

/** Beat target word count, as a string to match the prototype's chips. */
export type BeatWords = "200" | "400" | "600";

/** Min / max manuscript font size (px) — clamps the −/+ stepper. */
export const FONT_SIZE_MIN = 13;
export const FONT_SIZE_MAX = 24;

interface EditorState {
  /* ---- Format-menu-driven manuscript settings (live on the article) ---- */
  msFont: EditorFont;
  fmSize: number;
  fmSpacing: EditorSpacing;
  msWidth: EditorWidth;
  docIndent: boolean;

  /* ---- Modes ---- */
  /** Distraction-free focus mode (hides shell chrome). */
  focusOn: boolean;
  /** Clean-write / AI-free mode: hides AI affordances, shows plain format bar. */
  aiFreeOn: boolean;

  /* ---- Transient editor signals (mirrored into the StatusBar) ---- */
  saveState: SaveState;
  wordCount: number;

  /* ---- Inline scene-beat card ---- */
  beatState: BeatState;
  beatWords: BeatWords;

  /* ---- Format actions ---- */
  setFont: (font: EditorFont) => void;
  decFontSize: () => void;
  incFontSize: () => void;
  setSpacing: (spacing: EditorSpacing) => void;
  setWidth: (width: EditorWidth) => void;
  toggleIndent: () => void;

  /* ---- Mode actions ---- */
  toggleFocus: () => void;
  setAiFree: (on: boolean) => void;

  /* ---- Signal actions ---- */
  setSaveState: (state: SaveState) => void;
  setWordCount: (count: number) => void;

  /* ---- Beat actions ---- */
  setBeatState: (state: BeatState) => void;
  setBeatWords: (words: BeatWords) => void;
  /** Reset transient signals when the active scene changes / on unmount. */
  resetForScene: () => void;
}

/** Resolve a font choice to the concrete CSS font-family stack (prototype). */
export function fontFamilyFor(font: EditorFont): string {
  if (font === "Source Sans 3") return "'Source Sans 3', sans-serif";
  if (font === "system") return "ui-sans-serif, system-ui, sans-serif";
  return "'Literata', Georgia, serif";
}

/** Resolve a width preset to the article max-width (prototype values). */
export function maxWidthFor(width: EditorWidth): string {
  if (width === "wide") return "900px";
  if (width === "narrow") return "620px";
  return "760px";
}

export const useEditorStore = create<EditorState>((set) => ({
  msFont: "Literata",
  fmSize: 17,
  fmSpacing: "1.75",
  msWidth: "normal",
  docIndent: false,

  focusOn: false,
  aiFreeOn: false,

  saveState: "saved",
  wordCount: 0,

  beatState: "hidden",
  beatWords: "400",

  setFont: (font) => set({ msFont: font }),
  decFontSize: () =>
    set((s) => ({ fmSize: Math.max(FONT_SIZE_MIN, s.fmSize - 1) })),
  incFontSize: () =>
    set((s) => ({ fmSize: Math.min(FONT_SIZE_MAX, s.fmSize + 1) })),
  setSpacing: (spacing) => set({ fmSpacing: spacing }),
  setWidth: (width) => set({ msWidth: width }),
  toggleIndent: () => set((s) => ({ docIndent: !s.docIndent })),

  toggleFocus: () => set((s) => ({ focusOn: !s.focusOn })),
  setAiFree: (on) => set({ aiFreeOn: on }),

  setSaveState: (state) => set({ saveState: state }),
  setWordCount: (count) => set({ wordCount: count }),

  setBeatState: (state) => set({ beatState: state }),
  setBeatWords: (words) => set({ beatWords: words }),

  resetForScene: () =>
    set({ saveState: "saved", wordCount: 0, beatState: "hidden" }),
}));
