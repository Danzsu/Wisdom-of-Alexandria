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
});
