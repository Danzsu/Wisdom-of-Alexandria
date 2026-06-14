import { Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";
import { CodexMentionView } from "./codex-mention-view";

export interface CodexMentionOptions {
  /** Called when a mention is activated (click / Enter) with the codex id. */
  onOpenCodex?: (codexId: string) => void;
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    codexMention: {
      /** Insert a codex mention atom carrying the given label. */
      insertCodexMention: (label: string) => ReturnType;
    };
  }
}

/**
 * CodexMention — an inline atom node rendering a dotted-accent underline span
 * with a hover popover (see {@link CodexMentionView}). Stored in the doc JSON as
 * `{ type: 'codexMention', attrs: { label } }` so it round-trips through save.
 * The "@" insertion path uses `insertCodexMention`; auto-detection of names from
 * the manuscript is deferred (M6).
 */
export const CodexMention = Node.create<CodexMentionOptions>({
  name: "codexMention",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addOptions() {
    return { onOpenCodex: undefined };
  },

  addAttributes() {
    return {
      label: {
        default: "",
        parseHTML: (el) =>
          (el as HTMLElement).dataset.label ?? el.textContent,
        renderHTML: (attrs) => ({ "data-label": attrs.label as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-codex-mention]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-codex-mention": "" }),
      node.attrs.label as string,
    ];
  },

  renderText({ node }) {
    return node.attrs.label as string;
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodexMentionView);
  },

  addCommands() {
    return {
      insertCodexMention:
        (label: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { label },
          }),
    };
  },
});
