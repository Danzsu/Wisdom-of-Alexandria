import { describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { SelectionBubbleMenu } from "../selection-bubble-menu";

function BubbleHarness({
  onAction = vi.fn(),
  onReady,
}: {
  onAction?: (a: string) => void;
  onReady?: (e: Editor) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A lány nem fordult meg." }] },
      ],
    },
    onCreate: ({ editor: ed }) => onReady?.(ed),
  });
  return (
    <div>
      <EditorContent editor={editor} />
      {editor ? (
        <SelectionBubbleMenu
          editor={editor}
          onAction={(a) => onAction(a)}
        />
      ) : null}
    </div>
  );
}

describe("SelectionBubbleMenu", () => {
  it("shows the pill toolbar on a text selection and fires the AI stub action", async () => {
    let editor: Editor | null = null;
    const onAction = vi.fn();
    render(<BubbleHarness onAction={onAction} onReady={(e) => (editor = e)} />);
    await waitFor(() => expect(editor).not.toBeNull());

    // Select the whole paragraph so the bubble menu's shouldShow turns true.
    act(() => {
      (editor as Editor)
        .chain()
        .focus()
        .setTextSelection({ from: 1, to: 10 })
        .run();
    });

    const toolbar = await screen.findByRole("toolbar", {
      name: "Kijelölés műveletei",
    });
    expect(toolbar).toBeInTheDocument();

    // Átírás → AI stub action.
    fireEvent.click(screen.getByRole("button", { name: "Átírás" }));
    expect(onAction).toHaveBeenCalledWith("rewrite");
  });

  it("fires the codex + audio actions", async () => {
    let editor: Editor | null = null;
    const onAction = vi.fn();
    render(<BubbleHarness onAction={onAction} onReady={(e) => (editor = e)} />);
    await waitFor(() => expect(editor).not.toBeNull());
    act(() => {
      (editor as Editor)
        .chain()
        .focus()
        .setTextSelection({ from: 1, to: 10 })
        .run();
    });
    await screen.findByRole("toolbar", { name: "Kijelölés műveletei" });

    fireEvent.click(screen.getByRole("button", { name: "Codexbe" }));
    expect(onAction).toHaveBeenCalledWith("codex");

    fireEvent.click(screen.getByRole("button", { name: "Hang csatolása" }));
    expect(onAction).toHaveBeenCalledWith("audio");
  });
});
