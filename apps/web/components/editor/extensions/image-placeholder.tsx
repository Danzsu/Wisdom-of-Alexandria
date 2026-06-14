"use client";

import {
  Node,
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Image as ImageIcon, RectangleHorizontal, Trash2 } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";

export interface ImagePlaceholderOptions {
  /** Called when the dropzone is clicked (stub → toast). */
  onUpload?: () => void;
}

type ImageLayout = "full" | "left" | "right";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    imagePlaceholder: {
      /** Insert an image-placeholder block (no upload — V2). */
      insertImagePlaceholder: () => ReturnType;
    };
  }
}

/** NodeView: dashed dropzone + caption input + layout toggle (STUB — no upload). */
function ImagePlaceholderView({ node, updateAttributes, deleteNode, extension }: NodeViewProps) {
  const layout = (node.attrs.layout as ImageLayout) ?? "full";
  const caption = (node.attrs.caption as string) ?? "";
  const onUpload = extension.options.onUpload as (() => void) | undefined;

  const layoutBtn = (value: ImageLayout, label: string, icon: typeof ImageIcon) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-state={layout === value ? "on" : "off"}
      className={cn(
        "flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-border bg-surface text-text-soft",
        layout === value && "border-accent bg-accent-muted text-accent-text",
      )}
      onClick={() => updateAttributes({ layout: value })}
    >
      <Icon icon={icon} size={14} />
    </button>
  );

  return (
    <NodeViewWrapper as="figure" className="mb-[18px] font-sans" data-image-placeholder="">
      <button
        type="button"
        className="flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-muted text-text-faint transition-colors hover:border-accent hover:bg-accent-muted hover:text-accent-text"
        onClick={() => onUpload?.()}
      >
        <Icon icon={ImageIcon} size={30} strokeWidth={1.4} />
        <span className="text-[13px] font-semibold">
          {hu.write.imagePlaceholderTitle}
        </span>
        <span className="text-[12px]">{hu.write.imagePlaceholderHint}</span>
      </button>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={caption}
          placeholder={hu.write.imageCaptionPlaceholder}
          aria-label={hu.write.imageCaptionPlaceholder}
          className="h-[30px] flex-1 rounded-lg border border-border bg-surface px-2.5 text-[12px] text-text outline-none focus-visible:border-accent"
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
        <div className="flex gap-[3px]">
          {layoutBtn("full", hu.write.imageLayoutFullAria, RectangleHorizontal)}
          {layoutBtn("left", hu.write.imageLayoutLeftAria, RectangleHorizontal)}
          {layoutBtn("right", hu.write.imageLayoutRightAria, RectangleHorizontal)}
          <button
            type="button"
            aria-label={hu.write.imageRemoveAria}
            title={hu.write.imageRemoveAria}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-border bg-surface text-danger-text hover:border-danger hover:bg-danger-muted"
            onClick={() => deleteNode()}
          >
            <Icon icon={Trash2} size={13} />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

/**
 * ImagePlaceholder (STUB) — a block node storing `{ alt, caption, layout }` in
 * the doc JSON. No real upload in M4 (clicking the dropzone fires `onUpload`
 * which the page surfaces as a "feltöltés a V2-ben" toast). The stored shape is
 * the seam for the future media-table + EPUB embed pipeline.
 */
export const ImagePlaceholder = Node.create<ImagePlaceholderOptions>({
  name: "imagePlaceholder",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { onUpload: undefined };
  },

  addAttributes() {
    return {
      alt: { default: "" },
      caption: { default: "" },
      layout: { default: "full" },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-image-placeholder]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-image-placeholder": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImagePlaceholderView);
  },

  addCommands() {
    return {
      insertImagePlaceholder:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});
