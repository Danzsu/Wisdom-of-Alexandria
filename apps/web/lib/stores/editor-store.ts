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

/** The AI-inspector tabs (vertical icon+label rail). */
export type InspectorTab =
  | "ai"
  | "codex"
  | "beats"
  | "revisions"
  | "warnings"
  | "meta";

/**
 * A snapshot of the manuscript selection at the moment an AI action is
 * triggered. The inspector reads `text` (shown in the QuoteBox + sent to the
 * model); `from`/`to` record the ProseMirror range so an accepted rewrite can
 * replace exactly the originating selection. `null` when there is no selection.
 */
export interface SelectionSnapshot {
  text: string;
  from: number;
  to: number;
}

/**
 * A function the editor registers so the inspector can insert accepted AI text.
 * `range` (when present) is the originating selection — a rewrite replaces it;
 * a generate/continue/describe insert with no range appends after the cursor.
 * Implementations MUST apply the `woaFlash` highlight on the inserted text.
 */
export type ApplySuggestionFn = (
  text: string,
  range: { from: number; to: number } | null,
) => void;

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
  /**
   * Focus-paragraph mode (iA Writer style): dims every paragraph except the one
   * containing the cursor. Independent of {@link focusOn} (which hides chrome).
   */
  focusParaOn: boolean;
  /** Clean-write / AI-free mode: hides AI affordances, shows plain format bar. */
  aiFreeOn: boolean;

  /* ---- Transient editor signals (mirrored into the StatusBar) ---- */
  saveState: SaveState;
  wordCount: number;
  /**
   * Number of warnings from the most recent continuity check on the active
   * scene (`null` = not checked yet this scene). Drives the toolbar continuity
   * badge. Written by the Warnings tab on a successful check; reset per scene.
   */
  continuityWarningCount: number | null;

  /* ---- Inline scene-beat card ---- */
  beatState: BeatState;
  beatWords: BeatWords;

  /* ---- AI inspector ---- */
  /** Which inspector tab is shown (AI / Codex / Beatek / Figyelmeztetések / Meta). */
  inspectorTab: InspectorTab;
  /**
   * The user-chosen active model id, or `null` to use the backend default. Set by
   * the ModelSelector; read by every generation call + the beat card badge.
   * Never a hardcoded name — the id always comes from the config-driven list.
   */
  activeModel: string | null;
  /** Selection captured when the active AI action was triggered (null = none). */
  aiSelection: SelectionSnapshot | null;
  /**
   * Bridge the editor registers so the inspector can insert accepted text. Lives
   * in the store (not React state) so the inspector — rendered by the shell,
   * across the route boundary — can reach the editor without prop-drilling.
   */
  applySuggestion: ApplySuggestionFn | null;

  /* ---- Format actions ---- */
  setFont: (font: EditorFont) => void;
  decFontSize: () => void;
  incFontSize: () => void;
  setSpacing: (spacing: EditorSpacing) => void;
  setWidth: (width: EditorWidth) => void;
  toggleIndent: () => void;

  /* ---- Mode actions ---- */
  toggleFocus: () => void;
  /** Toggle focus-paragraph (cursor-paragraph) dimming. */
  toggleFocusPara: () => void;
  setAiFree: (on: boolean) => void;

  /* ---- Signal actions ---- */
  setSaveState: (state: SaveState) => void;
  setWordCount: (count: number) => void;
  /** Record the warning count from the latest continuity check (or clear it). */
  setContinuityWarningCount: (count: number | null) => void;

  /* ---- Beat actions ---- */
  setBeatState: (state: BeatState) => void;
  setBeatWords: (words: BeatWords) => void;

  /* ---- AI inspector actions ---- */
  setInspectorTab: (tab: InspectorTab) => void;
  /** Set the active model id (from the config-driven ModelSelector). */
  setActiveModel: (model: string | null) => void;
  /** Capture the current selection (or clear it). */
  setAiSelection: (selection: SelectionSnapshot | null) => void;
  /** Register / clear the editor's insert bridge (editor mount / unmount). */
  setApplySuggestion: (fn: ApplySuggestionFn | null) => void;

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
  focusParaOn: false,
  aiFreeOn: false,

  saveState: "saved",
  wordCount: 0,
  continuityWarningCount: null,

  beatState: "hidden",
  beatWords: "400",

  inspectorTab: "ai",
  activeModel: null,
  aiSelection: null,
  applySuggestion: null,

  setFont: (font) => set({ msFont: font }),
  decFontSize: () =>
    set((s) => ({ fmSize: Math.max(FONT_SIZE_MIN, s.fmSize - 1) })),
  incFontSize: () =>
    set((s) => ({ fmSize: Math.min(FONT_SIZE_MAX, s.fmSize + 1) })),
  setSpacing: (spacing) => set({ fmSpacing: spacing }),
  setWidth: (width) => set({ msWidth: width }),
  toggleIndent: () => set((s) => ({ docIndent: !s.docIndent })),

  toggleFocus: () => set((s) => ({ focusOn: !s.focusOn })),
  toggleFocusPara: () => set((s) => ({ focusParaOn: !s.focusParaOn })),
  setAiFree: (on) => set({ aiFreeOn: on }),

  setSaveState: (state) => set({ saveState: state }),
  setWordCount: (count) => set({ wordCount: count }),
  setContinuityWarningCount: (count) => set({ continuityWarningCount: count }),

  setBeatState: (state) => set({ beatState: state }),
  setBeatWords: (words) => set({ beatWords: words }),

  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setActiveModel: (model) => set({ activeModel: model }),
  setAiSelection: (selection) => set({ aiSelection: selection }),
  setApplySuggestion: (fn) => set({ applySuggestion: fn }),

  resetForScene: () =>
    set({
      saveState: "saved",
      wordCount: 0,
      beatState: "hidden",
      aiSelection: null,
      // A continuity result is scene-specific; clear it so the toolbar badge
      // never carries a stale count into a different scene.
      continuityWarningCount: null,
    }),
}));
