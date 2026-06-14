import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BeatCard } from "../extensions/beat-card";
import { Providers } from "@/test/test-utils";
import { AI_GENERATED_TEXT, SCENE_ACTIVE } from "@/test/msw/fixtures";

/**
 * A tiny harness mounting an editor with the BeatCard, inserting one card. The
 * card now calls the REAL generate-scene endpoint (mocked by MSW), so the
 * harness is wrapped in the query providers.
 */
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
        sceneId: SCENE_ACTIVE.id,
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

function renderHarness(props?: Parameters<typeof BeatHarness>[0]) {
  return render(
    <Providers>
      <BeatHarness {...props} />
    </Providers>,
  );
}

describe("InlineBeatCard state machine", () => {
  it("inserts in the config state with the word chips + beat input", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("insert-beat"));

    expect(
      await screen.findByRole("button", { name: "Beat generálása" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "200" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "400" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "600" })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Jelenet beat leírása"),
    ).toBeInTheDocument();
  });

  it("config → generating → ready (real endpoint), Apply approves + inserts", async () => {
    const onGenerate = vi.fn();
    const onApply = vi.fn();
    renderHarness({ onGenerate, onApply });

    fireEvent.click(screen.getByText("insert-beat"));
    const generate = await screen.findByRole("button", {
      name: "Beat generálása",
    });

    // config → generating (the real generate-scene call fires).
    fireEvent.click(generate);
    expect(onGenerate).toHaveBeenCalledTimes(1);

    // generating → ready: the REAL generated text (from MSW) appears.
    expect(
      await screen.findByText(AI_GENERATED_TEXT, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: "Alkalmaz" });

    // ready → applied (revision approved, prose inserted, card removed)
    fireEvent.click(apply);
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Alkalmaz" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("Elvet discards the card and fires onDiscard", async () => {
    const onDiscard = vi.fn();
    renderHarness({ onDiscard });
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
