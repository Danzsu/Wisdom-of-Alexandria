import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BeatCard } from "../extensions/beat-card";
import { BEAT_STUB_PREVIEW } from "../extensions/beat-card-view";

/** A tiny harness mounting an editor with the BeatCard, inserting one card. */
function BeatHarness({
  onGenerate = vi.fn(),
  onApply = vi.fn(),
  onDiscard = vi.fn(),
}: {
  onGenerate?: () => void;
  onApply?: () => void;
  onDiscard?: () => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      BeatCard.configure({
        modelName: "ollama/llama3.2",
        onGenerate,
        onApply,
        onDiscard,
      }),
    ],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => editor?.chain().focus().insertBeatCard().run()}
      >
        insert-beat
      </button>
      <EditorContent editor={editor} />
    </div>
  );
}

describe("InlineBeatCard state machine", () => {
  it("inserts in the config state with the word chips", async () => {
    render(<BeatHarness />);
    fireEvent.click(screen.getByText("insert-beat"));

    expect(
      await screen.findByRole("button", { name: "Beat generálása" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "200" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "400" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "600" })).toBeInTheDocument();
  });

  it("config → generating → ready, then Apply inserts prose + fires onApply", async () => {
    const onGenerate = vi.fn();
    const onApply = vi.fn();
    render(<BeatHarness onGenerate={onGenerate} onApply={onApply} />);

    fireEvent.click(screen.getByText("insert-beat"));
    const generate = await screen.findByRole("button", {
      name: "Beat generálása",
    });

    // config → generating
    fireEvent.click(generate);
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Generálás folyamatban…")).toBeInTheDocument();

    // generating → ready (stub timer ~1600ms — wait for the preview).
    expect(
      await screen.findByText(BEAT_STUB_PREVIEW, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: "Alkalmaz" });

    // ready → applied (card removed, prose inserted)
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Alkalmaz" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("Elvet discards the card and fires onDiscard", async () => {
    const onDiscard = vi.fn();
    render(<BeatHarness onDiscard={onDiscard} />);
    fireEvent.click(screen.getByText("insert-beat"));
    await screen.findByRole("button", { name: "Beat generálása" });

    fireEvent.click(screen.getByRole("button", { name: "Beat elvetése" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Beat generálása" }),
      ).not.toBeInTheDocument(),
    );
  });
});
