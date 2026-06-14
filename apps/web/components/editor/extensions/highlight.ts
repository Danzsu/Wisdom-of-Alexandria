import { Mark, mergeAttributes } from "@tiptap/react";

/**
 * Minimal highlight mark. StarterKit does not bundle `@tiptap/extension-highlight`
 * and we avoid adding an uninstalled dependency, so this is a tiny self-contained
 * mark that wraps the selection in a tinted span. The clean-write formatting bar
 * toggles it via `editor.commands.toggleHighlight()`.
 */
declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    highlight: {
      toggleHighlight: () => ReturnType;
    };
  }
}

export const Highlight = Mark.create({
  name: "highlight",

  parseHTML() {
    return [{ tag: "mark" }, { style: "background-color" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(HTMLAttributes, { class: "woa-ms-highlight" }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleHighlight:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});
