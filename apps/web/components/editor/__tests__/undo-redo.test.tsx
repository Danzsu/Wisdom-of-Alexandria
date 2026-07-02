/**
 * Undo/redo in the manuscript editor (gap-fix #2).
 *
 * Tiptap v3's StarterKit bundles the UndoRedo (history) extension, so Mod+Z
 * worked at the ProseMirror level — but it was undiscoverable (no toolbar
 * buttons, absent from the shortcuts overlay) and unguarded by tests. These
 * tests pin:
 *   - undo reverts typed text, redo reapplies it,
 *   - the new toolbar buttons enable/disable off `can().undo()/redo()`,
 *   - the scene-seed `setContent` is NOT recorded in history (undo must never
 *     restore a PREVIOUS scene's text into the current scene),
 *   - CRITICAL autosave interplay: after an undo, the next debounced autosave
 *     PATCH carries the ORIGINAL (reverted) content,
 *   - the shortcuts overlay data lists Mod+Z / Mod+Shift+Z.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { ManuscriptEditor } from "../manuscript-editor";
import { AiToolbar } from "../ai-toolbar";
import { useAutosave, AUTOSAVE_DELAY_MS } from "../use-autosave";
import { SHORTCUT_GROUPS } from "@/lib/shortcut-data";
import { CHAPTER_TWO, SCENE_ACTIVE } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";

const base = `${API_BASE_URL}/api/v1`;
const noop = () => {};
const slashCallbacks = {
  onBeat: noop,
  onContinue: noop,
  onCodexProgression: noop,
};

const ORIGINAL = "Eredeti kézirat szöveg.";

type EditorRef = { current: Editor | null };

function editorProps(editorRef: EditorRef) {
  return {
    kicker: "II. FEJEZET",
    title: "A könyvtár árnyai",
    modelName: "ollama/llama3.2",
    onOpenCodex: noop,
    onBubbleAction: noop,
    onBeatGenerate: noop,
    onBeatApply: noop,
    onBeatDiscard: noop,
    onImageUpload: noop,
    onAudioActivate: noop,
    onTableAction: noop,
    slashCallbacks,
    onEditorReady: (e: Editor | null) => {
      editorRef.current = e;
    },
  };
}

/** Editor + the real AiToolbar wired the way the Write page wires them. */
function ToolbarHarness({ editorRef }: { editorRef: EditorRef }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const props = editorProps(editorRef);
  return (
    <>
      <AiToolbar editor={editor} onAction={noop} />
      <ManuscriptEditor
        {...props}
        sceneId={SCENE_ACTIVE.id}
        initialContent={ORIGINAL}
        onChange={noop}
        onEditorReady={(e) => {
          setEditor(e);
          editorRef.current = e;
        }}
      />
    </>
  );
}

/** Editor wired to the REAL debounced autosave (like the Write page). */
function AutosaveHarness({ editorRef }: { editorRef: EditorRef }) {
  const { scheduleSave } = useAutosave({
    chapterId: CHAPTER_TWO.id,
    sceneId: SCENE_ACTIVE.id,
  });
  const props = editorProps(editorRef);
  return (
    <ManuscriptEditor
      {...props}
      sceneId={SCENE_ACTIVE.id}
      initialContent={ORIGINAL}
      onChange={(content) => scheduleSave(content)}
    />
  );
}

async function waitEditor(editorRef: EditorRef): Promise<Editor> {
  await waitFor(() => expect(editorRef.current).not.toBeNull());
  return editorRef.current as Editor;
}

describe("Manuscript editor — undo/redo", () => {
  it("undo reverts typed text and redo reapplies it", async () => {
    const editorRef: EditorRef = { current: null };
    render(
      <Providers>
        <ToolbarHarness editorRef={editorRef} />
      </Providers>,
    );
    const editor = await waitEditor(editorRef);

    act(() => {
      editor.chain().focus("end").insertContent(" Új mondat.").run();
    });
    expect(editor.getText()).toContain("Új mondat.");

    act(() => {
      editor.commands.undo();
    });
    // EXACT original text back — not merely "something changed".
    expect(editor.getText()).toBe(ORIGINAL);

    act(() => {
      editor.commands.redo();
    });
    expect(editor.getText()).toContain("Új mondat.");
  });

  it("toolbar undo/redo buttons disable/enable off the history state and work on click", async () => {
    const editorRef: EditorRef = { current: null };
    render(
      <Providers>
        <ToolbarHarness editorRef={editorRef} />
      </Providers>,
    );
    const editor = await waitEditor(editorRef);

    const undoButton = await screen.findByRole("button", {
      name: hu.write.undoAria,
    });
    const redoButton = screen.getByRole("button", { name: hu.write.redoAria });

    // Fresh scene: nothing to undo or redo.
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    act(() => {
      editor.chain().focus("end").insertContent(" Gépelve.").run();
    });
    await waitFor(() => expect(undoButton).toBeEnabled());
    expect(redoButton).toBeDisabled();

    await userEvent.click(undoButton);
    await waitFor(() => expect(editor.getText()).toBe(ORIGINAL));
    await waitFor(() => expect(redoButton).toBeEnabled());
    expect(undoButton).toBeDisabled();

    await userEvent.click(redoButton);
    await waitFor(() => expect(editor.getText()).toContain("Gépelve."));
  });

  it("Mod+Z on the editor DOM triggers the undo keymap", async () => {
    const editorRef: EditorRef = { current: null };
    render(
      <Providers>
        <ToolbarHarness editorRef={editorRef} />
      </Providers>,
    );
    const editor = await waitEditor(editorRef);

    act(() => {
      editor.chain().focus("end").insertContent(" Billentyű.").run();
    });
    expect(editor.getText()).toContain("Billentyű.");

    const textbox = screen.getByRole("textbox", { name: hu.write.editorAria });
    fireEvent.keyDown(textbox, { key: "z", code: "KeyZ", ctrlKey: true });
    await waitFor(() => expect(editor.getText()).toBe(ORIGINAL));

    // Mod+Shift+Z redoes.
    fireEvent.keyDown(textbox, {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
      shiftKey: true,
    });
    await waitFor(() => expect(editor.getText()).toContain("Billentyű."));
  });

  it("the scene-seed setContent is NOT undoable (a scene switch can never be undone into cross-scene text)", async () => {
    const editorRef: EditorRef = { current: null };
    const props = editorProps(editorRef);
    const { rerender } = render(
      <Providers>
        <ManuscriptEditor
          {...props}
          sceneId="scene-a"
          initialContent="A jelenet szövege."
          onChange={noop}
        />
      </Providers>,
    );
    const editor = await waitEditor(editorRef);
    await waitFor(() =>
      expect(editor.getText()).toBe("A jelenet szövege."),
    );

    // Same mounted editor, new scene identity → the seed effect runs setContent.
    rerender(
      <Providers>
        <ManuscriptEditor
          {...props}
          sceneId="scene-b"
          initialContent="B jelenet szövege."
          onChange={noop}
        />
      </Providers>,
    );
    await waitFor(() => expect(editor.getText()).toBe("B jelenet szövege."));

    // The seed must NOT be a history entry: undo here would restore scene A's
    // text into scene B (and autosave would then PATCH it to scene B — data
    // corruption). can().undo() must be false.
    expect(editor.can().undo()).toBe(false);
  });

  it("CRITICAL: after an undo the next debounced autosave PATCHes the ORIGINAL content", async () => {
    const patched: Array<{ sceneId: string; content: unknown }> = [];
    server.use(
      http.patch(
        `${base}/chapters/:chapterId/scenes/:sceneId`,
        async ({ params, request }) => {
          const body = (await request.json()) as { content?: unknown };
          patched.push({
            sceneId: String(params.sceneId),
            content: body.content,
          });
          return HttpResponse.json({
            ...SCENE_ACTIVE,
            content: String(body.content ?? ""),
          });
        },
      ),
    );

    const editorRef: EditorRef = { current: null };
    render(
      <Providers>
        <AutosaveHarness editorRef={editorRef} />
      </Providers>,
    );
    const editor = await waitEditor(editorRef);

    // Type → the debounced autosave fires with the TYPED text.
    act(() => {
      editor.chain().focus("end").insertContent(" Gépelt kiegészítés.").run();
    });
    await waitFor(() => expect(patched.length).toBe(1), {
      timeout: AUTOSAVE_DELAY_MS * 4,
    });
    expect(String(patched[0].content)).toContain("Gépelt kiegészítés.");

    // Undo → onUpdate fires again → the NEXT autosave carries the ORIGINAL text.
    act(() => {
      editor.commands.undo();
    });
    await waitFor(() => expect(patched.length).toBe(2), {
      timeout: AUTOSAVE_DELAY_MS * 4,
    });
    // Exact equality — a save that still carried the typed text would fail.
    expect(patched[1].content).toBe(ORIGINAL);
    expect(patched[1].sceneId).toBe(SCENE_ACTIVE.id);
  });

  it("the shortcuts overlay data lists undo (Mod+Z) and redo (Mod+Shift+Z)", () => {
    const editorGroup = SHORTCUT_GROUPS.find((g) => g.key === "editor");
    expect(editorGroup).toBeDefined();
    expect(editorGroup?.entries).toContainEqual({
      label: hu.shortcuts.undo,
      keys: ["Mod", "Z"],
    });
    expect(editorGroup?.entries).toContainEqual({
      label: hu.shortcuts.redo,
      keys: ["Mod", "Shift", "Z"],
    });
  });

  it("a11y: the toolbar with the undo/redo buttons has no violations", async () => {
    const editorRef: EditorRef = { current: null };
    const { container } = render(
      <Providers>
        <ToolbarHarness editorRef={editorRef} />
      </Providers>,
    );
    await waitEditor(editorRef);
    await screen.findByRole("button", { name: hu.write.undoAria });
    await expectNoA11yViolations(container);
  });
});
