import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  CodexMention,
  AudioMark,
  ImagePlaceholder,
  ManuscriptTable,
} from "../extensions";

interface HarnessProps {
  onOpenCodex?: (id: string) => void;
  onAudioActivate?: () => void;
  onImageUpload?: () => void;
  onTableAction?: (a: "add-row" | "edit") => void;
  onReady?: (editor: Editor) => void;
}

function ExtHarness({
  onOpenCodex = vi.fn(),
  onAudioActivate = vi.fn(),
  onImageUpload = vi.fn(),
  onTableAction = vi.fn(),
  onReady,
}: HarnessProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      CodexMention.configure({ onOpenCodex }),
      AudioMark.configure({ onActivate: onAudioActivate }),
      ImagePlaceholder.configure({ onUpload: onImageUpload }),
      ManuscriptTable.configure({ onAction: onTableAction }),
    ],
    content: { type: "doc", content: [{ type: "paragraph" }] },
    onCreate: ({ editor: ed }) => onReady?.(ed),
  });
  return (
    <div>
      <button
        type="button"
        onClick={() => editor?.chain().focus().insertCodexMention("Szelene").run()}
      >
        ins-mention
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().insertImagePlaceholder().run()}
      >
        ins-image
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().insertAudioMark().run()}
      >
        ins-audio
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().insertManuscriptTable().run()}
      >
        ins-table
      </button>
      <EditorContent editor={editor} />
    </div>
  );
}

describe("CodexMention", () => {
  it("renders the mention and shows the popover on hover", async () => {
    render(<ExtHarness />);
    fireEvent.click(screen.getByText("ins-mention"));

    const mention = await screen.findByRole("button", { name: "Szelene" });
    expect(mention).toBeInTheDocument();

    // Hover the wrapping span to reveal the popover card.
    const wrapper = mention.closest("[data-codex-mention]");
    expect(wrapper).not.toBeNull();
    fireEvent.mouseEnter(wrapper as HTMLElement);

    expect(
      await screen.findByText("Karakter · főszereplő"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Megnyitás a Codexben →"),
    ).toBeInTheDocument();
  });

  it("activates onOpenCodex when the mention is clicked", async () => {
    const onOpenCodex = vi.fn();
    render(<ExtHarness onOpenCodex={onOpenCodex} />);
    fireEvent.click(screen.getByText("ins-mention"));
    const mention = await screen.findByRole("button", { name: "Szelene" });
    fireEvent.click(mention);
    expect(onOpenCodex).toHaveBeenCalledWith("codex-szelene");
  });
});

describe("ImagePlaceholder (stub)", () => {
  it("inserts a dropzone node and fires the upload stub on click", async () => {
    const onImageUpload = vi.fn();
    render(<ExtHarness onImageUpload={onImageUpload} />);
    fireEvent.click(screen.getByText("ins-image"));

    const dropzone = await screen.findByText(
      "Kép helye — húzd ide, illeszd be, vagy tallózz",
    );
    fireEvent.click(dropzone);
    expect(onImageUpload).toHaveBeenCalledTimes(1);
  });

  it("stores layout in the node (left/right toggle)", async () => {
    let editor: Editor | null = null;
    render(<ExtHarness onReady={(e) => (editor = e)} />);
    fireEvent.click(screen.getByText("ins-image"));
    await screen.findByText("Kép helye — húzd ide, illeszd be, vagy tallózz");

    fireEvent.click(screen.getByRole("button", { name: "Balra" }));
    await waitFor(() => {
      const json = (editor as Editor).getJSON();
      const fig = json.content?.find((n) => n.type === "imagePlaceholder");
      expect(fig?.attrs?.layout).toBe("left");
    });
  });
});

describe("AudioMark (stub)", () => {
  it("inserts the glyph and fires the prototype stub on click", async () => {
    const onAudioActivate = vi.fn();
    render(<ExtHarness onAudioActivate={onAudioActivate} />);
    fireEvent.click(screen.getByText("ins-audio"));

    const glyph = await screen.findByRole("button", { name: "Hang" });
    fireEvent.click(glyph);
    expect(onAudioActivate).toHaveBeenCalledTimes(1);
  });
});

describe("ManuscriptTable (stub)", () => {
  it("inserts a table block", async () => {
    render(<ExtHarness />);
    fireEvent.click(screen.getByText("ins-table"));
    expect(await screen.findByText("Szereplő")).toBeInTheDocument();
    expect(screen.getByText("Akadály")).toBeInTheDocument();
  });
});
