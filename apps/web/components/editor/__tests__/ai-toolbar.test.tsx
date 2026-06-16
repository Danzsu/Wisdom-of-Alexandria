import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/test-utils";
import { AiToolbar } from "../ai-toolbar";
import { useEditorStore } from "@/lib/stores/editor-store";

function reset() {
  useEditorStore.setState({
    msFont: "Literata",
    fmSize: 17,
    msWidth: "normal",
    fmSpacing: "1.75",
    focusOn: false,
    wordCount: 1482,
    saveState: "saved",
  });
}

describe("AiToolbar", () => {
  beforeEach(reset);

  it("renders the split buttons + actions + word count + Mentve", () => {
    render(
      <Providers>
        <AiToolbar editor={null} onAction={vi.fn()} />
      </Providers>,
    );
    expect(screen.getByRole("button", { name: /Írás/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Átírás/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ötletelés/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Formátum/ })).toBeInTheDocument();
    // Hungarian-grouped word count.
    expect(screen.getByText("1 482 szó")).toBeInTheDocument();
    expect(screen.getByText("Mentve")).toBeInTheDocument();
  });

  it("fires onAction for the rewrite pill (stubbed in the page)", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <Providers>
        <AiToolbar editor={null} onAction={onAction} />
      </Providers>,
    );
    await user.click(screen.getByRole("button", { name: /Átírás/ }));
    expect(onAction).toHaveBeenCalledWith("rewrite");
  });

  it("toggles focus mode in the store", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <AiToolbar editor={null} onAction={vi.fn()} />
      </Providers>,
    );
    expect(useEditorStore.getState().focusOn).toBe(false);
    await user.click(screen.getByRole("button", { name: "Fókusz mód" }));
    expect(useEditorStore.getState().focusOn).toBe(true);
  });

  it("toggles focus-paragraph mode in the store (independent of focus mode)", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <AiToolbar editor={null} onAction={vi.fn()} />
      </Providers>,
    );
    expect(useEditorStore.getState().focusParaOn).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Bekezdés-fókusz" }),
    );
    expect(useEditorStore.getState().focusParaOn).toBe(true);
    // Independent: chrome-hiding focus mode is untouched.
    expect(useEditorStore.getState().focusOn).toBe(false);
  });

  it("Format menu mutates the editor-store (font / size / width)", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <AiToolbar editor={null} onAction={vi.fn()} />
      </Providers>,
    );
    await user.click(screen.getByRole("button", { name: /Formátum/ }));

    // Font → Source Sans.
    await user.click(screen.getByRole("button", { name: /Source Sans/ }));
    expect(useEditorStore.getState().msFont).toBe("Source Sans 3");

    // Size +.
    await user.click(screen.getByRole("button", { name: "Nagyobb" }));
    expect(useEditorStore.getState().fmSize).toBe(18);

    // Width → Széles.
    await user.click(screen.getByRole("button", { name: "Széles" }));
    expect(useEditorStore.getState().msWidth).toBe("wide");

    // Spacing → Dupla.
    await user.click(screen.getByRole("button", { name: "Dupla" }));
    expect(useEditorStore.getState().fmSpacing).toBe("2.1");
  });

  it("shows the saving + error states", () => {
    useEditorStore.setState({ saveState: "saving" });
    const { rerender } = render(
      <Providers>
        <AiToolbar editor={null} onAction={vi.fn()} />
      </Providers>,
    );
    expect(screen.getByText("Mentés…")).toBeInTheDocument();

    useEditorStore.setState({ saveState: "error" });
    rerender(
      <Providers>
        <AiToolbar editor={null} onAction={vi.fn()} />
      </Providers>,
    );
    expect(screen.getByText("Mentés sikertelen")).toBeInTheDocument();
  });
});
