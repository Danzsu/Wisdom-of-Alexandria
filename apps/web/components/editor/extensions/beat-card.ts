import { Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";
import { BeatCardView, type BeatWordChoice } from "./beat-card-view";

export interface BeatCardOptions {
  /** Active model name (config-driven, threaded from `useModels`). */
  modelName?: string;
  /** Active scene id — sent as `scene_id` on the generate-scene request. */
  sceneId?: string;
  /** Fired when the user triggers generation (with the chosen word count). */
  onGenerate?: (words: BeatWordChoice) => void;
  /** Fired after the approved prose is applied into the manuscript. */
  onApply?: () => void;
  /** Fired when the card is discarded. */
  onDiscard?: () => void;
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    beatCard: {
      /** Insert an inline beat card (starts in the `config` state). */
      insertBeatCard: () => ReturnType;
    };
  }
}

/**
 * InlineBeatCard — a block node holding the scene-beat state machine in its own
 * attrs (`state`: config|generating|ready, `words`: 200|400|600). The view
 * (BeatCardView) drives the transitions; the real generation is an M5 stub, so
 * `onGenerate` only notifies the page (toast) and the card self-advances via a
 * timer. Apply inserts the stub prose and removes the card.
 */
export const BeatCard = Node.create<BeatCardOptions>({
  name: "beatCard",
  group: "block",
  atom: true,

  addOptions() {
    return {
      modelName: "—",
      sceneId: undefined,
      onGenerate: undefined,
      onApply: undefined,
      onDiscard: undefined,
    };
  },

  addAttributes() {
    return {
      state: { default: "config" },
      words: { default: "400" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-beat-card]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-beat-card": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BeatCardView);
  },

  addCommands() {
    return {
      insertBeatCard:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { state: "config", words: "400" },
          }),
    };
  },
});
