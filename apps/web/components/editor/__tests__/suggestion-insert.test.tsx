import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { SuggestionInsert } from "../extensions/suggestion-insert";

/** Mount an editor with the SuggestionInsert extension and hand it up. */
function Harness({ onReady }: { onReady: (e: Editor) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, SuggestionInsert],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Eredeti szöveg." }] }] },
    onCreate: ({ editor: ed }) => onReady(ed),
  });
  return <EditorContent editor={editor} />;
}

async function mountEditor(): Promise<Editor> {
  let editor: Editor | null = null;
  render(<Harness onReady={(e) => (editor = e)} />);
  await waitFor(() => expect(editor).not.toBeNull());
  return editor as unknown as Editor;
}

describe("SuggestionInsert.applySuggestion", () => {
  it("replaces the originating range (rewrite)", async () => {
    const editor = await mountEditor();
    // Replace the word "Eredeti" (positions 1..8 in the single paragraph).
    editor.chain().focus().applySuggestion("Átírt", { from: 1, to: 8 }).run();
    expect(editor.getText()).toContain("Átírt");
    expect(editor.getText()).not.toContain("Eredeti");
  });

  it("appends a new paragraph when no range is given (insert)", async () => {
    const editor = await mountEditor();
    const before = editor.getText();
    editor.chain().focus().applySuggestion("Új bekezdés.", null).run();
    expect(editor.getText()).toContain("Új bekezdés.");
    // The original content is preserved (insert, not replace).
    expect(editor.getText()).toContain(before);
  });

  it("is a no-op for empty text", async () => {
    const editor = await mountEditor();
    const before = editor.getText();
    editor.chain().focus().applySuggestion("   ", null).run();
    expect(editor.getText()).toBe(before);
  });

  it("flashes the inserted range then clears it", async () => {
    vi.useFakeTimers();
    try {
      let editor: Editor | null = null;
      render(<Harness onReady={(e) => (editor = e)} />);
      // useEditor resolves synchronously enough; advance microtasks.
      await vi.waitFor(() => expect(editor).not.toBeNull());
      const ed = editor as unknown as Editor;
      ed.chain().focus().applySuggestion("Villanás.", null).run();
      // The flash decoration class is present right after insert.
      expect(ed.view.dom.querySelector(".woa-ai-flash")).not.toBeNull();
      // After the flash duration it clears.
      vi.advanceTimersByTime(1200);
      expect(ed.view.dom.querySelector(".woa-ai-flash")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
