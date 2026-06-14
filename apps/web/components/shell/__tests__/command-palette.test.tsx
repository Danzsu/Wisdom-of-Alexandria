import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUIStore } from "@/lib/stores/ui-store";

const push = vi.fn();
let pathname = "/konyv/demo/terv";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

const setThemeMock = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: setThemeMock }),
}));

import { CommandPalette } from "../command-palette";
import { CommandPaletteHotkey } from "../command-palette-hotkey";

function renderPalette() {
  return render(
    <>
      <CommandPaletteHotkey />
      <CommandPalette />
    </>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    push.mockClear();
    setThemeMock.mockClear();
    pathname = "/konyv/demo/terv";
    useUIStore.setState({ openMenu: null, commandOpen: false, sparkActive: false });
  });

  afterEach(() => {
    useUIStore.getState().clearSpark();
  });

  it("is closed by default and opens when the store flag is set", async () => {
    renderPalette();
    expect(screen.queryByText("Jelenetek")).not.toBeInTheDocument();
    useUIStore.getState().openCommand();
    expect(await screen.findByText("Jelenetek")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("Műveletek")).toBeInTheDocument();
  });

  it("toggles via Cmd/Ctrl+K", async () => {
    renderPalette();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(useUIStore.getState().commandOpen).toBe(true);
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("filters results by the query and shows the no-results state", async () => {
    renderPalette();
    useUIStore.getState().openCommand();
    const input = await screen.findByPlaceholderText(/Keresés a projektben/);
    await userEvent.type(input, "Szelene");
    expect(screen.getByText("Szelene")).toBeInTheDocument();
    expect(
      screen.queryByText("3. jelenet — Rejtett jelek"),
    ).not.toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "zzzznope");
    expect(screen.getByText(/Nincs találat erre/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Létrehozás/ })).toBeInTheDocument();
  });

  it("clicking a navigable result routes and closes the palette", async () => {
    renderPalette();
    useUIStore.getState().openCommand();
    const sceneRow = await screen.findByText("3. jelenet — Rejtett jelek");
    await userEvent.click(sceneRow);
    expect(push).toHaveBeenCalledWith("/konyv/demo/iras/demo");
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("the theme action toggles the theme and closes the palette", async () => {
    renderPalette();
    useUIStore.getState().openCommand();
    const themeRow = await screen.findByText("Téma váltása");
    await userEvent.click(themeRow);
    expect(setThemeMock).toHaveBeenCalledWith("dark");
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("exposes a listbox with selectable options and a default active row", async () => {
    renderPalette();
    useUIStore.getState().openCommand();
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    // First result is active by default.
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    // The input points at the active row via aria-activedescendant.
    const input = await screen.findByPlaceholderText(/Keresés a projektben/);
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("ArrowDown then Enter runs the active result (roving keyboard nav)", async () => {
    renderPalette();
    useUIStore.getState().openCommand();
    const input = await screen.findByPlaceholderText(/Keresés a projektben/);
    input.focus();
    // Move the active row down once, then activate it with Enter.
    await userEvent.keyboard("{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    // The second result is a scene row → navigates and closes the palette.
    expect(push).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("ArrowUp wraps the active row to the last result", async () => {
    renderPalette();
    useUIStore.getState().openCommand();
    const input = await screen.findByPlaceholderText(/Keresés a projektben/);
    input.focus();
    await userEvent.keyboard("{ArrowUp}");
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
  });
});
