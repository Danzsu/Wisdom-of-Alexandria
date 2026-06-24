"use client";

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Highlight,
  CodexMention,
  AudioMark,
  ImagePlaceholder,
  ManuscriptTable,
  BeatCard,
  SuggestionInsert,
  FocusParagraph,
} from "./extensions";
import {
  useEditorStore,
  fontFamilyFor,
  maxWidthFor,
  type ApplySuggestionFn,
} from "@/lib/stores/editor-store";
import { countWords } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { textToDoc } from "./manuscript-content";
import { SlashMenu, type SlashMenuCallbacks } from "./slash-menu";
import {
  SelectionBubbleMenu,
  type BubbleAction,
} from "./selection-bubble-menu";

/**
 * Fallback model name shown before the real model list loads. The active model
 * is config-driven (ModelSelector / `useModels`) and threaded in via `modelName`
 * — this is only the pre-load placeholder, never a hardcoded production value.
 */
export const STATIC_MODEL_NAME = "—";

export interface ManuscriptEditorProps {
  /**
   * Scene identity. The init effect re-seeds the doc only when THIS changes — not
   * when {@link initialContent} changes (a post-save server echo must not clobber
   * in-flight edits). The page also keys this component on the scene id so a
   * switch remounts it; this prop makes the identity dependency explicit/testable.
   */
  sceneId: string;
  /** Initial plain-text content for the scene. */
  initialContent: string | null;
  /** Chapter kicker, e.g. "II. FEJEZET". */
  kicker: string;
  /** Scene/chapter title (H1). */
  title: string;
  /** Scene subtitle (H2), optional. */
  subtitle?: string;
  /**
   * Active model name (config-driven, from `useModels` / the ModelSelector).
   * Shown on the inline beat card; never a hardcoded literal.
   */
  modelName: string;
  /** Called (debounced upstream) whenever the editor content changes. */
  onChange: (content: string, wordCount: number) => void;
  /** Open a codex entry (mention click). */
  onOpenCodex: (codexId: string) => void;
  /** AI / stub actions (bubble menu, beat, image, audio, table). M5/M6 fill. */
  onBubbleAction: (action: BubbleAction) => void;
  /** Fired when the user triggers beat generation (with the chosen word count). */
  onBeatGenerate: (words: "200" | "400" | "600") => void;
  onBeatApply: () => void;
  onBeatDiscard: () => void;
  onImageUpload: () => void;
  onAudioActivate: () => void;
  onTableAction: (action: "add-row" | "edit") => void;
  /** Slash-menu AI/codex callbacks. */
  slashCallbacks: SlashMenuCallbacks;
  /** Exposes the live editor instance to the parent (for toolbar wiring). */
  onEditorReady?: (editor: Editor | null) => void;
}

/**
 * The Tiptap manuscript editor. Builds the editor with StarterKit + the M4
 * custom extensions, initializes from the scene text, applies the live
 * editor-store styling (font/size/width/spacing/indent) to the article via
 * inline styles + CSS vars, reports content changes (for autosave + word count),
 * and renders the slash + selection bubble menus. Cleans up via `editor.destroy`
 * (handled by `useEditor`).
 */
export function ManuscriptEditor({
  sceneId,
  initialContent,
  kicker,
  title,
  subtitle,
  modelName,
  onChange,
  onOpenCodex,
  onBubbleAction,
  onBeatGenerate,
  onBeatApply,
  onBeatDiscard,
  onImageUpload,
  onAudioActivate,
  onTableAction,
  slashCallbacks,
  onEditorReady,
}: Readonly<ManuscriptEditorProps>) {
  const msFont = useEditorStore((s) => s.msFont);
  const fmSize = useEditorStore((s) => s.fmSize);
  const fmSpacing = useEditorStore((s) => s.fmSpacing);
  const msWidth = useEditorStore((s) => s.msWidth);
  const docIndent = useEditorStore((s) => s.docIndent);
  const focusParaOn = useEditorStore((s) => s.focusParaOn);

  // Latest scene content kept in a ref so the seed effect can read it WITHOUT
  // depending on it (a post-save echo into `initialContent` must not re-trigger
  // the seed). The seed runs only on scene-identity change; it reads the current
  // value here, which on a fresh mount is this scene's persisted content.
  const initialContentRef = useRef(initialContent);
  initialContentRef.current = initialContent;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Highlight,
      CodexMention.configure({ onOpenCodex }),
      AudioMark.configure({ onActivate: onAudioActivate }),
      ImagePlaceholder.configure({ onUpload: onImageUpload }),
      ManuscriptTable.configure({ onAction: onTableAction }),
      BeatCard.configure({
        modelName,
        sceneId,
        onGenerate: onBeatGenerate,
        onApply: onBeatApply,
        onDiscard: onBeatDiscard,
      }),
      SuggestionInsert,
      FocusParagraph,
    ],
    content: textToDoc(initialContent),
    editorProps: {
      attributes: {
        class: "woa-manuscript-prose outline-none",
        "aria-label": hu.write.editorAria,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText();
      onChange(text, countWords(text));
    },
  });

  // Seed the doc on scene IDENTITY change only — never on content change. A
  // post-save server echo flows back into `initialContent`; re-seeding off that
  // would call `setContent` on the live editor and clobber keystrokes typed
  // during the save's network window (and reset the cursor). Keying on `sceneId`
  // (the page also remounts via `key={scene.id}`, so on a switch this runs once
  // on the fresh mount). The extra equality guard makes the no-op explicit if the
  // effect ever re-runs with text the editor already shows.
  useEffect(() => {
    if (!editor) return;
    const next = initialContentRef.current ?? "";
    if (editor.getText() === next) return;
    editor.commands.setContent(textToDoc(next), { emitUpdate: false });
    // Seed the live word count for the new scene without scheduling a save.
    useEditorStore.getState().setWordCount(countWords(editor.getText()));
    // Depend ONLY on the editor instance + scene identity — NOT initialContent
    // (read via the ref above), so a post-save server echo never re-seeds.
  }, [editor, sceneId]);

  // Hand the editor instance up so the toolbar can drive formatting commands.
  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  // Register the insert bridge in the store so the AI inspector (rendered by the
  // shell, across the route boundary) can apply ACCEPTED suggestions into the
  // editor. This is the ONLY path AI text reaches the manuscript, and it fires
  // only from the inspector's explicit Accept handler — never automatically.
  const setApplySuggestion = useEditorStore((s) => s.setApplySuggestion);
  const applySuggestion = useCallback<ApplySuggestionFn>(
    (text, range) => {
      if (!editor) return;
      editor.chain().focus().applySuggestion(text, range).run();
    },
    [editor],
  );
  useEffect(() => {
    if (!editor) return;
    setApplySuggestion(applySuggestion);
    return () => setApplySuggestion(null);
  }, [editor, applySuggestion, setApplySuggestion]);

  const articleStyle = useMemo<CSSProperties>(
    () => ({
      maxWidth: maxWidthFor(msWidth),
      fontFamily: fontFamilyFor(msFont),
      fontSize: `${fmSize}px`,
      lineHeight: fmSpacing,
    }),
    [msWidth, msFont, fmSize, fmSpacing],
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-soft px-8 pb-16 pt-10">
      <article
        data-testid="manuscript-article"
        data-indent={docIndent ? "on" : "off"}
        data-focus-para={focusParaOn ? "on" : "off"}
        style={articleStyle}
        className="woa-manuscript-article mx-auto rounded-2xl border border-border bg-surface-soft py-[clamp(28px,4vw,48px)] px-[clamp(22px,5vw,64px)] shadow-panel [hyphens:auto]"
      >
        <p className="m-0 mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-text">
          {kicker}
        </p>
        <h1 className="m-0 mb-1.5 font-serif text-[26px] font-semibold leading-[1.25] text-text [hyphens:none] [text-wrap:balance]">
          {title}
        </h1>
        {subtitle ? (
          <h2 className="m-0 mb-7 font-serif text-[17px] font-medium italic text-text-muted [hyphens:none]">
            {subtitle}
          </h2>
        ) : null}

        <div className="relative">
          <EditorContent editor={editor} />
          <SlashMenu editor={editor} callbacks={slashCallbacks} />
        </div>
      </article>

      {editor ? (
        <SelectionBubbleMenu editor={editor} onAction={onBubbleAction} />
      ) : null}
    </div>
  );
}
