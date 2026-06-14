"use client";

import {
  Node,
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";

export interface ManuscriptTableOptions {
  /** Called for the row/cell actions (stub → toast). */
  onAction?: (action: "add-row" | "edit") => void;
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    manuscriptTable: {
      /** Insert a manuscript table block. */
      insertManuscriptTable: () => ReturnType;
    };
  }
}

/**
 * NodeView for the manuscript table.
 *
 * NOTE / DEVIATION: `@tiptap/extension-table` is not installed (StarterKit does
 * not bundle it and adding an uninstalled dependency is out of M4 scope). To stay
 * dependency-free yet ship the affordance, this is an atom block rendering the
 * prototype's table chrome; full cell editing + GFM-pipe Markdown serialization
 * is deferred to when the table extension is added. The header/cell actions fire
 * `onAction` (toasts) for now.
 */
function ManuscriptTableView({ deleteNode, extension }: NodeViewProps) {
  const onAction = extension.options.onAction as
    | ((a: "add-row" | "edit") => void)
    | undefined;

  return (
    <NodeViewWrapper
      as="div"
      className="mb-[18px] overflow-hidden rounded-[10px] border border-border font-sans"
      data-manuscript-table=""
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-soft px-2 py-1.5">
        <span className="flex-1 text-[11px] font-semibold text-text-muted">
          {hu.write.tableLabel}
        </span>
        <button
          type="button"
          aria-label={hu.write.tableAddRowAria}
          title={hu.write.tableAddRowAria}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          onClick={() => onAction?.("add-row")}
        >
          <Icon icon={Plus} size={13} />
        </button>
        <button
          type="button"
          aria-label={hu.write.tableDeleteAria}
          title={hu.write.tableDeleteAria}
          className="flex h-6 w-6 items-center justify-center rounded-md text-danger-text hover:bg-danger-muted"
          onClick={() => deleteNode()}
        >
          <Icon icon={Trash2} size={13} />
        </button>
      </div>
      <table className="w-full border-collapse text-[13px] text-text">
        <thead>
          <tr>
            <th className="border-b border-r border-border bg-surface-soft px-[11px] py-2 text-left font-semibold">
              {hu.write.tableColCharacter}
            </th>
            <th className="border-b border-r border-border bg-surface-soft px-[11px] py-2 text-left font-semibold">
              {hu.write.tableColGoal}
            </th>
            <th className="border-b border-border bg-surface-soft px-[11px] py-2 text-left font-semibold">
              {hu.write.tableColObstacle}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b border-r border-border px-[11px] py-2">Szelene</td>
            <td className="border-b border-r border-border px-[11px] py-2">
              Megfejteni a jeleket
            </td>
            <td className="border-b border-border px-[11px] py-2">Az őrség</td>
          </tr>
          <tr>
            <td className="border-r border-border px-[11px] py-2">Damianosz</td>
            <td className="border-r border-border px-[11px] py-2">
              Megvédeni Szelenét
            </td>
            <td className="px-[11px] py-2">A hűségesküje</td>
          </tr>
        </tbody>
      </table>
    </NodeViewWrapper>
  );
}

export const ManuscriptTable = Node.create<ManuscriptTableOptions>({
  name: "manuscriptTable",
  group: "block",
  atom: true,

  addOptions() {
    return { onAction: undefined };
  },

  parseHTML() {
    return [{ tag: "div[data-manuscript-table]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-manuscript-table": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ManuscriptTableView);
  },

  addCommands() {
    return {
      insertManuscriptTable:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});
