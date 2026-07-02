/**
 * Command palette — REAL search over the active book's data (gap-fix #1).
 *
 * The palette used to filter a static demo list; it now searches the actual
 * book tree (scenes + their chapter context) and the project's codex entries,
 * merged with the real actions group. These tests seed MSW with the Fárosz
 * fixtures and assert the palette finds THE seeded records and navigates to
 * their REAL routes (exact book/scene/entry ids — a wrong id or route fails).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { useUIStore } from "@/lib/stores/ui-store";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";
import {
  FAROSZ_BOOK,
  CHAPTER_ONE,
  CHAPTER_TWO,
  SCENE_ACTIVE,
  SCENE_FIRST,
} from "@/test/msw/fixtures";

const push = vi.fn();
let pathname = `/konyv/${FAROSZ_BOOK.id}/terv`;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const setThemeMock = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: setThemeMock }),
}));

import { CommandPalette } from "../command-palette";
import { CommandPaletteHotkey } from "../command-palette-hotkey";
import { searchCommands, type CommandResult } from "@/lib/command-data";

function renderPalette() {
  return render(
    <Providers>
      <CommandPaletteHotkey />
      <CommandPalette />
    </Providers>,
  );
}

/** Open the palette and wait for the REAL book data to populate the list. */
async function openLoaded() {
  useUIStore.getState().openCommand();
  // The seeded scene arriving proves the tree + codex queries resolved.
  await screen.findByText(SCENE_ACTIVE.title);
}

describe("CommandPalette — real search", () => {
  beforeEach(() => {
    push.mockClear();
    setThemeMock.mockClear();
    pathname = `/konyv/${FAROSZ_BOOK.id}/terv`;
    useUIStore.setState({
      openMenu: null,
      commandOpen: false,
      sparkActive: false,
      howItWorksOpen: false,
    });
  });

  afterEach(() => {
    useUIStore.getState().clearSpark();
  });

  it("is closed by default and lists REAL scenes + codex + actions when opened", async () => {
    renderPalette();
    expect(screen.queryByText(hu.command.groupScenes)).not.toBeInTheDocument();
    await openLoaded();

    // Group headers for all three sources.
    expect(screen.getByText(hu.command.groupScenes)).toBeInTheDocument();
    expect(screen.getByText(hu.command.groupCodex)).toBeInTheDocument();
    expect(screen.getByText(hu.command.groupActions)).toBeInTheDocument();

    // The SEEDED records, not the old static demo rows.
    expect(screen.getByText(SCENE_FIRST.title)).toBeInTheDocument();
    expect(screen.getByText("Szelene")).toBeInTheDocument();
    expect(screen.getByText("Nagykönyvtár")).toBeInTheDocument();
    // A scene row carries its chapter context as meta.
    expect(screen.getByText(CHAPTER_TWO.title)).toBeInTheDocument();
  });

  it("typing a scene title finds THAT scene; Enter navigates to its real Write route", async () => {
    renderPalette();
    await openLoaded();
    const input = screen.getByPlaceholderText(/Keresés a projektben/);
    await userEvent.type(input, "Rejtett");

    // Only the matching scene remains; the other scene is filtered out.
    expect(screen.getByText(SCENE_ACTIVE.title)).toBeInTheDocument();
    expect(screen.queryByText(SCENE_FIRST.title)).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    // EXACT route: /konyv/<real book id>/iras/<real scene id>. A wrong id or a
    // demo placeholder route fails here (mutation guard).
    expect(push).toHaveBeenCalledWith(
      routes.scene(FAROSZ_BOOK.id, SCENE_ACTIVE.id),
    );
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("finds a codex entry by name and navigates to the codex route with it selected", async () => {
    renderPalette();
    await openLoaded();
    const input = screen.getByPlaceholderText(/Keresés a projektben/);
    await userEvent.type(input, "szelene"); // lowercase — case-insensitive

    const row = await screen.findByText("Szelene");
    await userEvent.click(row);
    // The codex route + the `?entry=` selection param (how the codex screen
    // shares selection between sidebar and detail).
    expect(push).toHaveBeenCalledWith(
      `${routes.book(FAROSZ_BOOK.id, "codex")}?entry=codex-szelene`,
    );
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("matches accent-insensitively (»muszak« finds »műszak«)", async () => {
    renderPalette();
    await openLoaded();
    const input = screen.getByPlaceholderText(/Keresés a projektben/);
    await userEvent.type(input, "muszak");
    expect(await screen.findByText(SCENE_FIRST.title)).toBeInTheDocument();
    expect(screen.queryByText(SCENE_ACTIVE.title)).not.toBeInTheDocument();
  });

  it("ranks prefix matches above substring matches (searchCommands unit)", () => {
    const results: CommandResult[] = [
      { id: "a", group: "scenes", label: "Végső jelenet" },
      { id: "b", group: "scenes", label: "Jelenet a kikötőben" },
      { id: "c", group: "scenes", label: "Harmadik", meta: "jelenet-jegyzet" },
    ];
    const ranked = searchCommands(results, "jelenet");
    // Prefix ("Jelenet a kikötőben") first, label substring second, meta-only last.
    expect(ranked.map((r) => r.id)).toEqual(["b", "a", "c"]);
    // Non-matching queries drop the result entirely.
    expect(searchCommands(results, "zzznope")).toEqual([]);
  });

  it("outside a book (/projekt) offers actions only — no scene/codex groups, no export", async () => {
    pathname = "/projekt";
    renderPalette();
    useUIStore.getState().openCommand();
    expect(await screen.findByText(hu.command.groupActions)).toBeInTheDocument();
    expect(screen.getByText(hu.command.actionTheme)).toBeInTheDocument();
    // No book → no scene/codex results and no book-scoped export action.
    expect(screen.queryByText(hu.command.groupScenes)).not.toBeInTheDocument();
    expect(screen.queryByText(hu.command.groupCodex)).not.toBeInTheDocument();
    expect(screen.queryByText(hu.command.actionExport)).not.toBeInTheDocument();
  });

  it("toggles via Cmd/Ctrl+K", async () => {
    renderPalette();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(useUIStore.getState().commandOpen).toBe(true);
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("shows the no-results state with the create affordance", async () => {
    renderPalette();
    await openLoaded();
    const input = screen.getByPlaceholderText(/Keresés a projektben/);
    await userEvent.type(input, "zzzznope");
    expect(screen.getByText(/Nincs találat erre/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Létrehozás/ }),
    ).toBeInTheDocument();
  });

  it("the theme action still toggles the theme and closes the palette", async () => {
    renderPalette();
    await openLoaded();
    await userEvent.click(screen.getByText(hu.command.actionTheme));
    expect(setThemeMock).toHaveBeenCalledWith("dark");
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("the 'Hogyan működik' action opens the onboarding narrative", async () => {
    renderPalette();
    await openLoaded();
    await userEvent.click(screen.getByText(hu.command.actionHowItWorks));
    expect(useUIStore.getState().howItWorksOpen).toBe(true);
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("the export action navigates to the book's export route", async () => {
    renderPalette();
    await openLoaded();
    await userEvent.click(screen.getByText(hu.command.actionExport));
    expect(push).toHaveBeenCalledWith(routes.book(FAROSZ_BOOK.id, "export"));
  });

  it("keeps the roving keyboard nav: ArrowDown moves the active row, Enter runs it", async () => {
    renderPalette();
    await openLoaded();
    const input = screen.getByPlaceholderText(/Keresés a projektben/);
    input.focus();

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // The first scene in render order is CHAPTER_ONE's scene; index 1 is the
    // second scene (SCENE_ACTIVE). Enter must navigate to THAT scene.
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(
      routes.scene(FAROSZ_BOOK.id, SCENE_ACTIVE.id),
    );
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("ArrowUp wraps the active row to the last result", async () => {
    renderPalette();
    await openLoaded();
    const input = screen.getByPlaceholderText(/Keresés a projektben/);
    input.focus();
    await userEvent.keyboard("{ArrowUp}");
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
  });

  it("scene results in render order follow the chapter order (chapter context is real)", async () => {
    renderPalette();
    await openLoaded();
    const options = screen.getAllByRole("option");
    const labels = options.map((o) => o.textContent ?? "");
    const first = labels.findIndex((l) => l.includes(SCENE_FIRST.title));
    const second = labels.findIndex((l) => l.includes(SCENE_ACTIVE.title));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
    // Each scene row carries ITS OWN chapter title as meta (not a demo string).
    expect(labels[first]).toContain(CHAPTER_ONE.title);
    expect(labels[second]).toContain(CHAPTER_TWO.title);
  });

  it("a11y: the open palette with real results has no violations", async () => {
    renderPalette();
    await openLoaded();
    // Portalled dialog → scan the document.
    await expectNoA11yViolations(document);
  });
});
