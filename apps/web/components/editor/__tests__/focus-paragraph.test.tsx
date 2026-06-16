import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FocusParagraph, FOCUS_ACTIVE_CLASS } from "../extensions/focus-paragraph";

/** A 3-paragraph doc so we can move the cursor between blocks. */
const DOC = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Első bekezdés." }] },
    { type: "paragraph", content: [{ type: "text", text: "Második bekezdés." }] },
    { type: "paragraph", content: [{ type: "text", text: "Harmadik bekezdés." }] },
  ],
};

function Harness({ onReady }: { onReady: (e: Editor) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, FocusParagraph],
    content: DOC,
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

/** The text of the single element carrying the active-paragraph class. */
function activeText(editor: Editor): string | null {
  const el = editor.view.dom.querySelector(`.${FOCUS_ACTIVE_CLASS}`);
  return el?.textContent ?? null;
}

describe("FocusParagraph decoration", () => {
  it("marks the paragraph at the cursor as active", async () => {
    const editor = await mountEditor();
    // Place the cursor inside the second paragraph.
    const secondParaPos = editor.getText().indexOf("Második") + 2;
    editor.commands.setTextSelection(secondParaPos);
    await waitFor(() =>
      expect(activeText(editor)).toContain("Második bekezdés."),
    );
  });

  it("moves the active marker when the cursor changes block", async () => {
    const editor = await mountEditor();
    const firstPos = editor.getText().indexOf("Első") + 2;
    editor.commands.setTextSelection(firstPos);
    await waitFor(() => expect(activeText(editor)).toContain("Első bekezdés."));

    const thirdPos = editor.getText().indexOf("Harmadik") + 2;
    editor.commands.setTextSelection(thirdPos);
    await waitFor(() =>
      expect(activeText(editor)).toContain("Harmadik bekezdés."),
    );
  });

  it("marks exactly one block at a time", async () => {
    const editor = await mountEditor();
    editor.commands.setTextSelection(2);
    await waitFor(() =>
      expect(
        editor.view.dom.querySelectorAll(`.${FOCUS_ACTIVE_CLASS}`).length,
      ).toBe(1),
    );
  });
});
