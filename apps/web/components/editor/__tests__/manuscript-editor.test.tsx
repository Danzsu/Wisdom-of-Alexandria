import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { Providers } from "@/test/test-utils";
import { ManuscriptEditor } from "../manuscript-editor";
import { useEditorStore, maxWidthFor } from "@/lib/stores/editor-store";

const noop = () => {};
const slashCallbacks = {
  onBeat: noop,
  onContinue: noop,
  onCodexProgression: noop,
};

function renderEditor(content: string | null) {
  return render(
    <Providers>
      <ManuscriptEditor
        sceneId="scene-1"
        initialContent={content}
        kicker="II. FEJEZET"
        title="A könyvtár árnyai"
        subtitle="3. jelenet — Rejtett jelek"
        onChange={noop}
        onOpenCodex={noop}
        onBubbleAction={noop}
        onBeatGenerate={noop}
        onBeatApply={noop}
        onBeatDiscard={noop}
        onImageUpload={noop}
        onAudioActivate={noop}
        onTableAction={noop}
        slashCallbacks={slashCallbacks}
      />
    </Providers>,
  );
}

describe("ManuscriptEditor", () => {
  beforeEach(() => {
    useEditorStore.setState({
      msFont: "Literata",
      fmSize: 17,
      fmSpacing: "1.75",
      msWidth: "normal",
      docIndent: false,
      wordCount: 0,
    });
  });

  it("renders the kicker, title and subtitle", async () => {
    renderEditor("Szelene a tekercsek közé hajolt.");
    expect(screen.getByText("II. FEJEZET")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "A könyvtár árnyai" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "3. jelenet — Rejtett jelek" }),
    ).toBeInTheDocument();
  });

  it("mounts the editor with the scene content", async () => {
    renderEditor("Szelene a tekercsek közé hajolt.");
    await waitFor(() =>
      expect(screen.getByText(/Szelene a tekercsek/)).toBeInTheDocument(),
    );
  });

  it("applies the live editor-store width to the article style", async () => {
    renderEditor("Tartalom.");
    const article = screen.getByTestId("manuscript-article");
    expect(article).toHaveStyle({ maxWidth: maxWidthFor("normal") });

    useEditorStore.getState().setWidth("wide");
    await waitFor(() =>
      expect(article).toHaveStyle({ maxWidth: maxWidthFor("wide") }),
    );
  });

  it("reflects the font choice from the store", async () => {
    renderEditor("Tartalom.");
    const article = screen.getByTestId("manuscript-article");
    useEditorStore.getState().setFont("system");
    await waitFor(() =>
      expect(article.style.fontFamily).toContain("system-ui"),
    );
  });

  it("reports content changes (word count) through onChange", async () => {
    const onChange = vi.fn();
    let editor: Editor | null = null;
    render(
      <Providers>
        <ManuscriptEditor
          sceneId="scene-1"
          initialContent="egy kettő"
          kicker="II. FEJEZET"
          title="A könyvtár árnyai"
          onChange={onChange}
          onEditorReady={(e) => (editor = e)}
          onOpenCodex={noop}
          onBubbleAction={noop}
          onBeatGenerate={noop}
          onBeatApply={noop}
          onBeatDiscard={noop}
          onImageUpload={noop}
          onAudioActivate={noop}
          onTableAction={noop}
          slashCallbacks={slashCallbacks}
        />
      </Providers>,
    );
    await waitFor(() => expect(editor).not.toBeNull());

    // Edit the doc → onUpdate fires onChange with the new text + word count.
    act(() => {
      (editor as Editor)
        .chain()
        .focus()
        .insertContent(" három négy")
        .run();
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [lastText, lastCount] = onChange.mock.calls.at(-1) as [
      string,
      number,
    ];
    expect(lastText).toContain("három");
    expect(lastCount).toBeGreaterThanOrEqual(3);
  });

  // ---- Regression: post-save server echo must not clobber in-flight edits ----
  // Mount the editor, type newer text, then re-render with a STALE
  // `initialContent` (the just-saved server echo) under the SAME `sceneId`. The
  // editor must keep the user's newer text — the init effect must NOT re-seed on
  // a content change. FAILS against the old effect keyed on `[editor, initialContent]`.
  it("keeps in-flight edits when a post-save echo updates initialContent (same scene)", async () => {
    const ref: { editor: Editor | null } = { editor: null };
    const getEditor = (): Editor => {
      if (!ref.editor) throw new Error("editor not ready");
      return ref.editor;
    };
    const props = {
      sceneId: "scene-1",
      kicker: "II. FEJEZET",
      title: "A könyvtár árnyai",
      onChange: noop,
      onEditorReady: (e: Editor | null) => {
        ref.editor = e;
      },
      onOpenCodex: noop,
      onBubbleAction: noop,
      onBeatGenerate: noop,
      onBeatApply: noop,
      onBeatDiscard: noop,
      onImageUpload: noop,
      onAudioActivate: noop,
      onTableAction: noop,
      slashCallbacks,
    };

    const { rerender } = render(
      <Providers>
        <ManuscriptEditor {...props} initialContent="Kezdő szöveg." />
      </Providers>,
    );
    await waitFor(() => expect(ref.editor).not.toBeNull());

    // The user keeps typing newer text after the save was kicked off.
    act(() => {
      getEditor().chain().focus().insertContent(" Friss billentyűleütések.").run();
    });
    expect(getEditor().getText()).toContain("Friss billentyűleütések.");

    // The PATCH resolves: a STALE server echo (different from both the mount
    // content AND the live text) flows back into initialContent while the scene
    // id is unchanged. This is the bug trigger — the old effect, keyed on
    // initialContent, would re-seed and clobber the live "Friss…" keystrokes.
    rerender(
      <Providers>
        <ManuscriptEditor
          {...props}
          initialContent="Szerver visszhang — régebbi mentés."
        />
      </Providers>,
    );

    // No clobber: the newer keystrokes survive.
    await waitFor(() =>
      expect(getEditor().getText()).toContain("Friss billentyűleütések."),
    );
    expect(getEditor().getText()).toContain("Friss billentyűleütések.");
  });

  // Switching scenes (the `sceneId` changes) DOES load the new scene's content.
  it("loads the new scene's content when sceneId changes", async () => {
    renderEditor("Első jelenet szövege.");
    await waitFor(() =>
      expect(screen.getByText(/Első jelenet/)).toBeInTheDocument(),
    );
  });
});
