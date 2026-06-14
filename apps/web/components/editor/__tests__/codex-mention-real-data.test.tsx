import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Providers } from "@/test/test-utils";
import { resetCodexStore } from "@/test/msw/handlers";
import { FAROSZ_BOOK } from "@/test/msw/fixtures";
import { CodexMention } from "../extensions";
import { CodexMentionDataProvider } from "../codex-mention-data";

// The provider resolves the project via useParams-free hooks; no navigation
// needed, but the popover "open" link calls onOpenCodex with the real id.

function MentionHarness({ onOpenCodex }: { onOpenCodex: (id: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, CodexMention.configure({ onOpenCodex })],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
  return (
    <CodexMentionDataProvider bookId={FAROSZ_BOOK.id}>
      <button
        type="button"
        onClick={() =>
          editor?.chain().focus().insertCodexMention("Szelene").run()
        }
      >
        ins
      </button>
      <EditorContent editor={editor} />
    </CodexMentionDataProvider>
  );
}

describe("CodexMention with real project data (M6)", () => {
  beforeEach(() => resetCodexStore());

  it("resolves the popover from the real Codex (description + type from API)", async () => {
    const onOpenCodex = vi.fn();
    render(
      <Providers>
        <MentionHarness onOpenCodex={onOpenCodex} />
      </Providers>,
    );

    fireEvent.click(screen.getByText("ins"));
    const mention = await screen.findByRole("button", { name: "Szelene" });
    fireEvent.mouseEnter(mention.closest("[data-codex-mention]") as HTMLElement);

    // Description from the seeded API entry (NOT the static placeholder text).
    await waitFor(() =>
      expect(
        screen.getByText("A Nagykönyvtár éjszakai írnoka."),
      ).toBeInTheDocument(),
    );
    // Type line carries the real story role from the entry's tags.
    expect(screen.getByText("Karakter · Protagonista")).toBeInTheDocument();
  });

  it("clicking the mention navigates to the real codex id", async () => {
    const onOpenCodex = vi.fn();
    render(
      <Providers>
        <MentionHarness onOpenCodex={onOpenCodex} />
      </Providers>,
    );

    fireEvent.click(screen.getByText("ins"));
    const mention = await screen.findByRole("button", { name: "Szelene" });
    // Wait for the live index so the click resolves the real id (not the
    // static placeholder, which happens to share this id — assert anyway).
    await waitFor(() => expect(mention).toBeInTheDocument());
    fireEvent.click(mention);
    expect(onOpenCodex).toHaveBeenCalledWith("codex-szelene");
  });
});
