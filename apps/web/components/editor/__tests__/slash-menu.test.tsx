import { describe, expect, it, vi } from "vitest";
import {
  render as rtlRender,
  screen,
  fireEvent,
  waitFor,
  act,
  type RenderResult,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Providers } from "@/test/test-utils";
import { BeatCard } from "../extensions/beat-card";
import { SlashMenu, buildSlashItems } from "../slash-menu";

/** Render inside the query providers (the inline beat card calls AI hooks). */
function render(ui: ReactElement): RenderResult {
  return rtlRender(<Providers>{ui}</Providers>);
}

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

  it("sets aria-activedescendant to the active item's id (and items carry matching ids)", async () => {
    let editor: Editor | null = null;
    render(<SlashHarness onReady={(e) => (editor = e)} />);
    await waitFor(() => expect(editor).not.toBeNull());

    act(() => {
      (editor as Editor).chain().focus().insertContent("/").run();
    });
    const menu = await screen.findByRole("menu", { name: "Parancsmenü" });
    const active = menu.getAttribute("aria-activedescendant");
    expect(active).toBe("slash-item-beat");
    // The referenced id must resolve to a real menuitem.
    const target = document.getElementById(active as string);
    expect(target).not.toBeNull();
    expect(target).toHaveAttribute("role", "menuitem");

    // Arrow-down moves the descendant to the next item.
    fireEvent.keyDown(document, { key: "ArrowDown" });
    await waitFor(() =>
      expect(menu.getAttribute("aria-activedescendant")).toBe(
        "slash-item-continue",
      ),
    );
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
