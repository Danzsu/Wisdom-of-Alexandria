import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUIStore } from "@/lib/stores/ui-store";
import { hu } from "@/lib/i18n/hu";
import { ShortcutsOverlay } from "../shortcuts-overlay";
import { ShortcutsOverlayHotkey } from "../shortcuts-overlay-hotkey";

function renderOverlay() {
  return render(
    <>
      <ShortcutsOverlayHotkey />
      <ShortcutsOverlay />
    </>,
  );
}

describe("ShortcutsOverlay", () => {
  beforeEach(() => {
    useUIStore.setState({
      openMenu: null,
      commandOpen: false,
      shortcutsOpen: false,
      sparkActive: false,
    });
  });

  it("is closed by default and opens on `?`", async () => {
    renderOverlay();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.keyboard("?");
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(hu.shortcuts.title);
  });

  it("lists the real shortcuts grouped by area", async () => {
    renderOverlay();
    useUIStore.getState().openShortcuts();
    expect(await screen.findByText(hu.shortcuts.groupGeneral)).toBeInTheDocument();
    expect(screen.getByText(hu.shortcuts.groupEditor)).toBeInTheDocument();
    expect(screen.getByText(hu.shortcuts.groupAi)).toBeInTheDocument();
    // A couple of the real actions.
    expect(screen.getByText(hu.shortcuts.commandPalette)).toBeInTheDocument();
    expect(screen.getByText(hu.shortcuts.slashMenu)).toBeInTheDocument();
  });

  it("does NOT open while typing in an input", async () => {
    render(
      <>
        <input aria-label="field" />
        <ShortcutsOverlayHotkey />
        <ShortcutsOverlay />
      </>,
    );
    const input = screen.getByLabelText("field");
    input.focus();
    await userEvent.keyboard("?");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does NOT open while typing in a contenteditable (editor surface)", async () => {
    render(
      <>
        <div contentEditable aria-label="editor" suppressContentEditableWarning>
          text
        </div>
        <ShortcutsOverlayHotkey />
        <ShortcutsOverlay />
      </>,
    );
    const editor = screen.getByLabelText("editor");
    editor.focus();
    await userEvent.keyboard("?");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Esc", async () => {
    renderOverlay();
    useUIStore.getState().openShortcuts();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
