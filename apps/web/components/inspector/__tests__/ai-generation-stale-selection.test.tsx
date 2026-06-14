/**
 * Regression test for the stale-selection race in the editor-seam AI funnel
 * (`triggerAi` in the Write page → captureSelection + gen.trigger).
 *
 * The bug: `AiGenerationProvider.trigger` read `aiSelection` from its React-render
 * closure (the PREVIOUS render's value). For editor-seam actions (bubble / toolbar
 * / slash) the page calls `captureSelection(editor)` — which writes the FRESH
 * snapshot synchronously — immediately before `gen.trigger(action)`. With the
 * closure read:
 *   - First action on a fresh scene (store aiSelection === null): the no-selection
 *     guard wrongly toasted "Jelölj ki szöveget" despite a live selection.
 *   - A later action used the PREVIOUS selection's range, so Accept's
 *     applySuggestion replaced the WRONG span.
 *
 * The fix reads the snapshot from the store at call time
 * (`useEditorStore.getState().aiSelection`). These tests reproduce the seam with a
 * real Tiptap editor + the real `captureSelection` + the real provider, and assert
 * the CORRECT current range reaches `applySuggestion` on Elfogad. They fail against
 * the old closure-read behaviour and pass after the fix.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import {
  useEditor,
  EditorContent,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { server } from "@/test/msw/server";
import { Providers } from "@/test/test-utils";
import {
  useEditorStore,
  type ApplySuggestionFn,
} from "@/lib/stores/editor-store";
import { SuggestionInsert } from "@/components/editor/extensions/suggestion-insert";
import { AiGenerationProvider, useAiGeneration } from "../ai-generation-context";
import { AiTab } from "../ai-tab";
import { captureSelection } from "@/components/editor";
import { FAROSZ_BOOK, SCENE_ACTIVE } from "@/test/msw/fixtures";

vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id }),
  useRouter: () => ({ push: vi.fn() }),
}));

const DOC_TEXT = "Szelene a tekercsek közé hajolt a lámpás fényében.";

/** Records the (text, range) every applySuggestion call receives. */
let applySpy: ReturnType<typeof vi.fn<ApplySuggestionFn>>;
let editorRef: Editor | null = null;

/**
 * A faithful stand-in for the Write page's editor seam: a real Tiptap editor
 * that registers a real applySuggestion bridge into the store (mirroring
 * manuscript-editor.tsx), wrapped with a spy so the range is observable. The
 * "Átírás" button runs the REAL `triggerAi` body: captureSelection(editor) then
 * gen.trigger("rewrite").
 */
function EditorSeamHarness() {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, SuggestionInsert],
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: DOC_TEXT }] },
      ],
    },
    onCreate: ({ editor: ed }) => {
      editorRef = ed;
    },
  });

  const setApplySuggestion = useEditorStore((s) => s.setApplySuggestion);
  useEffect(() => {
    if (!editor) return;
    // Spy that delegates to the real editor command so the inserted span — and
    // thus the range correctness — is genuinely exercised.
    const bridge: ApplySuggestionFn = (text, range) => {
      applySpy(text, range);
      editor.chain().focus().applySuggestion(text, range).run();
    };
    setApplySuggestion(bridge);
    return () => setApplySuggestion(null);
  }, [editor, setApplySuggestion]);

  return <EditorContent editor={editor} />;
}

function renderSeam() {
  return render(
    <Providers>
      <AiGenerationProvider>
        <EditorSeamHarness />
        <AiTab />
        <TriggerControls />
      </AiGenerationProvider>
    </Providers>,
  );
}

/** A button that fires the real seam funnel (captureSelection → gen.trigger). */
function TriggerControls() {
  const gen = useAiGeneration();
  return (
    <button
      type="button"
      data-testid="seam-rewrite"
      onClick={() => {
        // The exact sequence the page's triggerAi runs for a toolbar/bubble action.
        captureSelection(editorRef);
        gen.trigger("rewrite");
      }}
    >
      seam-rewrite
    </button>
  );
}

/** Select a range on the real editor (ProseMirror positions are 1-based). */
function selectRange(from: number, to: number): void {
  editorRef?.chain().focus().setTextSelection({ from, to }).run();
}

describe("editor-seam AI funnel — stale-selection race", () => {
  beforeEach(() => {
    applySpy = vi.fn<ApplySuggestionFn>();
    editorRef = null;
    // A FRESH scene: the store selection starts null (resetForScene clears it),
    // exactly the first-action condition that wrongly tripped the guard.
    useEditorStore.setState({
      activeModel: null,
      inspectorTab: "ai",
      aiSelection: null,
      applySuggestion: null,
    });
  });
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it("first action on a fresh scene does NOT show the no-selection guard when a live selection exists", async () => {
    const user = userEvent.setup();
    renderSeam();
    await waitFor(() => expect(editorRef).not.toBeNull());
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    // Live selection on the editor; store.aiSelection is still null at this point.
    selectRange(1, 8); // "Szelene"
    expect(useEditorStore.getState().aiSelection).toBeNull();

    await user.click(screen.getByTestId("seam-rewrite"));

    // The guard toast must NOT appear — captureSelection wrote the fresh snapshot
    // and trigger read it from the store, so generation proceeds to a result card.
    expect(
      screen.queryByText("Jelölj ki szöveget az AI-művelethez"),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Átírás eredménye")).toBeInTheDocument();
  });

  it("Elfogad replaces the CURRENT selection range (not null, not a previous one)", async () => {
    const user = userEvent.setup();
    renderSeam();
    await waitFor(() => expect(editorRef).not.toBeNull());
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    // First action: select "Szelene" (1..8).
    selectRange(1, 8);
    await user.click(screen.getByTestId("seam-rewrite"));
    await screen.findByText("Átírás eredménye");
    await user.click(screen.getByRole("button", { name: "Elfogad" }));

    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(1));
    expect(applySpy).toHaveBeenLastCalledWith(expect.any(String), {
      from: 1,
      to: 8,
    });

    // Second action with a DIFFERENT selection: "tekercsek" later in the doc.
    const start = DOC_TEXT.indexOf("tekercsek") + 1; // +1 for the PM doc offset
    const end = start + "tekercsek".length;
    selectRange(start, end);
    await user.click(screen.getByTestId("seam-rewrite"));
    await screen.findByText("Átírás eredménye");
    await user.click(screen.getByRole("button", { name: "Elfogad" }));

    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(2));
    // The range must be the NEW selection — the old closure read would have used
    // the FIRST selection's range here (the data-integrity bug).
    expect(applySpy).toHaveBeenLastCalledWith(expect.any(String), {
      from: start,
      to: end,
    });
  });
});
