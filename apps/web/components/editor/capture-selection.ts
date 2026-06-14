import type { Editor } from "@tiptap/react";
import { useEditorStore } from "@/lib/stores/editor-store";

/**
 * Capture the editor's current text selection into the store so the AI inspector
 * (across the route boundary) can read it. Returns true when a non-empty
 * selection was captured. Empty selection clears the stored snapshot (whole-scene
 * actions like Continue are handled by the caller).
 *
 * This MUST run synchronously right before `gen.trigger(action)` in the Write
 * page's editor seam — `trigger` reads the snapshot back from the store at call
 * time (`useEditorStore.getState().aiSelection`), so the write here propagates to
 * the read without a render in between.
 */
export function captureSelection(editor: Editor | null): boolean {
  if (!editor) return false;
  const { from, to, empty } = editor.state.selection;
  if (empty) {
    useEditorStore.getState().setAiSelection(null);
    return false;
  }
  const text = editor.state.doc.textBetween(from, to, "\n", "\0");
  useEditorStore.getState().setAiSelection({ text, from, to });
  return text.trim().length > 0;
}
