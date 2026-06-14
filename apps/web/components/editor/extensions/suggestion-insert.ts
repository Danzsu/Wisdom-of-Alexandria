import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * SuggestionInsert — the human-in-the-loop INSERT bridge.
 *
 * The AI never writes to the manuscript on its own. This extension exposes a
 * single `applySuggestion(text, range)` command that the inspector calls ONLY
 * after the user explicitly accepts an AI revision:
 *
 * - `range` present (a rewrite of the originating selection): replace that range
 *   with `text`.
 * - `range` null (generate-scene / continue / describe insert): insert `text` at
 *   the current cursor as a new paragraph.
 *
 * In both cases the inserted span is briefly highlighted with the `woaFlash`
 * decoration (the `.woa-ai-flash` class) so the writer sees exactly what landed,
 * then the flash clears itself after one animation cycle. The decoration is
 * transient view state — it never persists into the doc / autosave payload.
 */
const flashPluginKey = new PluginKey<DecorationSet>("woaAiFlash");

/** How long the flash decoration stays on the inserted range (matches CSS). */
export const FLASH_DURATION_MS = 1100;

/** Meta payload: a range to flash, or "clear" to remove the decoration. */
type FlashMeta = { from: number; to: number } | "clear";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    suggestionInsert: {
      /**
       * Insert accepted AI text. Replaces `range` when given (rewrite), else
       * appends a paragraph at the cursor. Flashes the inserted span.
       */
      applySuggestion: (
        text: string,
        range: { from: number; to: number } | null,
      ) => ReturnType;
    };
  }
}

export const SuggestionInsert = Extension.create({
  name: "suggestionInsert",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: flashPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const meta = tr.getMeta(flashPluginKey) as FlashMeta | undefined;
            if (meta === "clear") return DecorationSet.empty;
            if (meta) {
              return DecorationSet.create(tr.doc, [
                Decoration.inline(meta.from, meta.to, {
                  class: "woa-ai-flash",
                }),
              ]);
            }
            return value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return flashPluginKey.getState(state);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      applySuggestion:
        (text, range) =>
        ({ editor, chain, state }) => {
          const trimmed = text.trim();
          if (trimmed.length === 0) return false;

          if (range) {
            // Rewrite: replace exactly the originating selection.
            chain()
              .focus()
              .insertContentAt({ from: range.from, to: range.to }, trimmed)
              .run();
            flashRange(editor, range.from, range.from + trimmed.length);
            return true;
          }

          // Insert: append a new paragraph at the current cursor position.
          const insertPos = state.selection.to;
          chain()
            .focus()
            .insertContentAt(insertPos, {
              type: "paragraph",
              content: [{ type: "text", text: trimmed }],
            })
            .run();
          // +1 to step inside the new paragraph node before the text.
          flashRange(editor, insertPos, insertPos + trimmed.length + 1);
          return true;
        },
    };
  },
});

/**
 * Set the flash decoration on a range, then clear it after one animation cycle.
 * Clamps the range to the current doc size and guards the (possibly unmounted)
 * view before the deferred clear dispatch.
 */
function flashRange(editor: Editor, from: number, to: number): void {
  const { view } = editor;
  if (view.isDestroyed) return;
  const docSize = view.state.doc.content.size;
  const clampedFrom = Math.max(0, Math.min(from, docSize));
  const clampedTo = Math.max(clampedFrom, Math.min(to, docSize));
  view.dispatch(
    view.state.tr.setMeta(flashPluginKey, {
      from: clampedFrom,
      to: clampedTo,
    } satisfies FlashMeta),
  );
  setTimeout(() => {
    if (view.isDestroyed) return;
    view.dispatch(view.state.tr.setMeta(flashPluginKey, "clear"));
  }, FLASH_DURATION_MS);
}
