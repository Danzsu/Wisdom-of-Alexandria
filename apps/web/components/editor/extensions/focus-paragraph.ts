import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * FocusParagraph — iA-Writer-style active-paragraph marker.
 *
 * Adds the `woa-focus-active` class (a NODE decoration) to the textblock that
 * contains the selection head. The actual dimming of the OTHER blocks is done
 * purely in CSS, gated behind the article's `data-focus-para="on"` attribute —
 * so toggling the mode is a cheap attribute flip with no plugin churn, and the
 * decoration itself is layout-free (opacity only).
 *
 * The decoration recomputes only when the selection's parent block changes (we
 * compare the resolved block start), so ordinary cursor movement within the same
 * paragraph costs nothing beyond the cheap equality check.
 */
const focusParaKey = new PluginKey("woaFocusParagraph");

/** The class applied to the active (cursor) textblock. */
export const FOCUS_ACTIVE_CLASS = "woa-focus-active";

/** Resolve the start position of the textblock containing `pos`. */
function activeBlockStart(doc: import("@tiptap/pm/model").Node, pos: number) {
  const $pos = doc.resolve(Math.min(pos, doc.content.size));
  // depth 0 is the doc; the nearest textblock ancestor is what we mark.
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).isTextblock) {
      return { from: $pos.before(depth), to: $pos.after(depth) };
    }
  }
  return null;
}

/** Build the decoration set marking the active textblock (or empty). */
function buildDecorations(
  doc: import("@tiptap/pm/model").Node,
  head: number,
): DecorationSet {
  const block = activeBlockStart(doc, head);
  if (!block) return DecorationSet.empty;
  return DecorationSet.create(doc, [
    Decoration.node(block.from, block.to, { class: FOCUS_ACTIVE_CLASS }),
  ]);
}

export const FocusParagraph = Extension.create({
  name: "focusParagraph",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: focusParaKey,
        state: {
          init: (_config, state) =>
            buildDecorations(state.doc, state.selection.head),
          apply(tr, value, _oldState, newState) {
            // Only rebuild on a doc or selection change; otherwise remap.
            if (tr.docChanged || tr.selectionSet) {
              return buildDecorations(newState.doc, newState.selection.head);
            }
            return value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return focusParaKey.getState(state);
          },
        },
      }),
    ];
  },
});
