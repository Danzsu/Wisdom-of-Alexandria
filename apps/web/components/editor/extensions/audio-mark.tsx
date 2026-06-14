"use client";

import {
  Node,
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Music } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";

export interface AudioMarkOptions {
  /** Called when the glyph is clicked (stub → toast). */
  onActivate?: () => void;
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    audioMark: {
      /** Insert an inline ♪ audio mark with the given metadata. */
      insertAudioMark: (attrs?: {
        audioId?: string;
        scope?: string;
        type?: string;
      }) => ReturnType;
    };
  }
}

/** NodeView: a small superscript music glyph (STUB — no playback). */
function AudioMarkView({ extension }: NodeViewProps) {
  const onActivate = extension.options.onActivate as (() => void) | undefined;
  return (
    <NodeViewWrapper
      as="span"
      className="ml-[5px] inline-flex align-super text-accent-text"
      data-audio-mark=""
    >
      <button
        type="button"
        aria-label={hu.write.audioMarkAria}
        className="inline-flex cursor-pointer items-center border-none bg-transparent p-0 text-accent-text"
        onClick={() => onActivate?.()}
      >
        <Icon icon={Music} size={11} strokeWidth={2} />
      </button>
    </NodeViewWrapper>
  );
}

/**
 * AudioMark (STUB) — an inline atom storing `{ audioId, scope, type }` in the doc
 * JSON for the future EPUB-3 media-overlay (SMIL) export. No playback / upload in
 * M4: clicking fires `onActivate` (the page shows a "(prototípus)" toast). V2
 * feature, excluded from MVP/V1 export.
 */
export const AudioMark = Node.create<AudioMarkOptions>({
  name: "audioMark",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,

  addOptions() {
    return { onActivate: undefined };
  },

  addAttributes() {
    return {
      audioId: { default: null },
      scope: { default: "scene" },
      type: { default: "atmosphere" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-audio-mark]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-audio-mark": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioMarkView);
  },

  addCommands() {
    return {
      insertAudioMark:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
