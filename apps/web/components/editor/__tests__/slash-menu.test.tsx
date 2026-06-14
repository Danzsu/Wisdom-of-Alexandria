import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BeatCard } from "../extensions/beat-card";
import { SlashMenu, buildSlashItems } from "../slash-menu";

function SlashHarness({
  onBeat = vi.fn(),
  onContinue = vi.fn(),
  onCodexProgression = vi.fn(),
  onReady,
}: {
  onBeat?: (e: Editor) => void;
  onContinue?: (e: Editor) => void;
  onCodexProgression?: (e: Editor) => void;
  onReady?: (e: Editor) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, BeatCard],
    content: { type: "doc", content: [{ type: "paragraph" }] },
    onCreate: ({ editor: ed }) => onReady?.(ed),
  });
  return (
    <div>
      <EditorContent editor={editor} />
      <SlashMenu
        editor={editor}
        callbacks={{ onBeat, onContinue, onCodexProgression }}
      />
    </div>
  );
}

describe("buildSlashItems", () => {
  it("lists the AI / Codex / Formázás sections", () => {
    const items = buildSlashItems({
      onBeat: vi.fn(),
      onContinue: vi.fn(),
      onCodexProgression: vi.fn(),
    });
    const sections = new Set(items.map((i) => i.section));
    expect(sections).toContain("AI");
    expect(sections).toContain("Codex");
    expect(sections).toContain("Formázás");
    expect(items.find((i) => i.id === "beat")).toBeTruthy();
  });
});

describe("SlashMenu", () => {
  it("opens when '/' is typed at the start of a line", async () => {
    let editor: Editor | null = null;
    render(<SlashHarness onReady={(e) => (editor = e)} />);
    await waitFor(() => expect(editor).not.toBeNull());

    act(() => {
      (editor as Editor).chain().focus().insertContent("/").run();
    });

    expect(
      await screen.findByRole("menu", { name: "Parancsmenü" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Jelenet beat/ }),
    ).toBeInTheDocument();
  });

  it("selecting 'Jelenet beat' inserts a beat card", async () => {
    let editor: Editor | null = null;
    const onBeat = vi.fn((e: Editor) => e.chain().focus().insertBeatCard().run());
    render(<SlashHarness onBeat={onBeat} onReady={(e) => (editor = e)} />);
    await waitFor(() => expect(editor).not.toBeNull());

    act(() => {
      (editor as Editor).chain().focus().insertContent("/").run();
    });
    const item = await screen.findByRole("menuitem", { name: /Jelenet beat/ });
    fireEvent.mouseDown(item);

    expect(onBeat).toHaveBeenCalledTimes(1);
    // The beat card config CTA appears in the manuscript.
    expect(
      await screen.findByRole("button", { name: "Beat generálása" }),
    ).toBeInTheDocument();
  });

  it("Escape closes the menu", async () => {
    let editor: Editor | null = null;
    render(<SlashHarness onReady={(e) => (editor = e)} />);
    await waitFor(() => expect(editor).not.toBeNull());

    act(() => {
      (editor as Editor).chain().focus().insertContent("/").run();
    });
    await screen.findByRole("menu", { name: "Parancsmenü" });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("menu", { name: "Parancsmenü" }),
      ).not.toBeInTheDocument(),
    );
  });
});
