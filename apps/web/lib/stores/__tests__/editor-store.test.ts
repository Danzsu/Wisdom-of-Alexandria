import { beforeEach, describe, expect, it } from "vitest";
import {
  useEditorStore,
  fontFamilyFor,
  maxWidthFor,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
} from "@/lib/stores/editor-store";

function reset() {
  useEditorStore.setState({
    msFont: "Literata",
    fmSize: 17,
    fmSpacing: "1.75",
    msWidth: "normal",
    docIndent: false,
    focusOn: false,
    aiFreeOn: false,
    saveState: "saved",
    wordCount: 0,
    beatState: "hidden",
    beatWords: "400",
  });
}

describe("editor-store defaults", () => {
  beforeEach(reset);

  it("mirror the prototype defaults", () => {
    const s = useEditorStore.getState();
    expect(s.msFont).toBe("Literata");
    expect(s.fmSize).toBe(17);
    expect(s.fmSpacing).toBe("1.75");
    expect(s.msWidth).toBe("normal");
    expect(s.beatWords).toBe("400");
  });
});

describe("format actions", () => {
  beforeEach(reset);

  it("sets the font", () => {
    useEditorStore.getState().setFont("system");
    expect(useEditorStore.getState().msFont).toBe("system");
  });

  it("clamps font size to the min/max", () => {
    const { setWordCount } = useEditorStore.getState();
    setWordCount(0); // unrelated, ensures store usable
    useEditorStore.setState({ fmSize: FONT_SIZE_MIN });
    useEditorStore.getState().decFontSize();
    expect(useEditorStore.getState().fmSize).toBe(FONT_SIZE_MIN);

    useEditorStore.setState({ fmSize: FONT_SIZE_MAX });
    useEditorStore.getState().incFontSize();
    expect(useEditorStore.getState().fmSize).toBe(FONT_SIZE_MAX);
  });

  it("steps font size within range", () => {
    useEditorStore.setState({ fmSize: 17 });
    useEditorStore.getState().incFontSize();
    expect(useEditorStore.getState().fmSize).toBe(18);
    useEditorStore.getState().decFontSize();
    expect(useEditorStore.getState().fmSize).toBe(17);
  });

  it("sets width + spacing + indent", () => {
    useEditorStore.getState().setWidth("wide");
    useEditorStore.getState().setSpacing("2.1");
    useEditorStore.getState().toggleIndent();
    const s = useEditorStore.getState();
    expect(s.msWidth).toBe("wide");
    expect(s.fmSpacing).toBe("2.1");
    expect(s.docIndent).toBe(true);
  });
});

describe("modes + signals", () => {
  beforeEach(reset);

  it("toggles focus and clean-write", () => {
    useEditorStore.getState().toggleFocus();
    expect(useEditorStore.getState().focusOn).toBe(true);
    useEditorStore.getState().setAiFree(true);
    expect(useEditorStore.getState().aiFreeOn).toBe(true);
  });

  it("tracks save state + word count + beat", () => {
    useEditorStore.getState().setSaveState("saving");
    useEditorStore.getState().setWordCount(42);
    useEditorStore.getState().setBeatState("ready");
    const s = useEditorStore.getState();
    expect(s.saveState).toBe("saving");
    expect(s.wordCount).toBe(42);
    expect(s.beatState).toBe("ready");
  });

  it("resetForScene clears transient signals", () => {
    useEditorStore.setState({
      saveState: "error",
      wordCount: 99,
      beatState: "ready",
    });
    useEditorStore.getState().resetForScene();
    const s = useEditorStore.getState();
    expect(s.saveState).toBe("saved");
    expect(s.wordCount).toBe(0);
    expect(s.beatState).toBe("hidden");
  });
});

describe("style resolvers", () => {
  it("maps fonts to CSS stacks", () => {
    expect(fontFamilyFor("Literata")).toContain("Literata");
    expect(fontFamilyFor("Source Sans 3")).toContain("Source Sans 3");
    expect(fontFamilyFor("system")).toContain("system-ui");
  });

  it("maps width presets to max-width", () => {
    expect(maxWidthFor("narrow")).toBe("620px");
    expect(maxWidthFor("normal")).toBe("760px");
    expect(maxWidthFor("wide")).toBe("900px");
  });
});
