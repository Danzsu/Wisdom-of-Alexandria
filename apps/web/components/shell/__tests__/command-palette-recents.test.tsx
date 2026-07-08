/**
 * Command palette — persisted recents (design pushRecent parity).
 *
 * Selecting any result (scene / codex / action) pushes it onto a persisted
 * recents list (localStorage "woa-recent-cmds", max 6, dedup by label, newest
 * first). On EMPTY query the palette shows a "Legutóbbiak" group FIRST (then
 * the default groups); recents render like normal results and re-execute
 * their ORIGINAL target on click/Enter. Stale targets (deleted scene) still
 * navigate — the route may 404, but the palette must not crash.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { useUIStore } from "@/lib/stores/ui-store";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";
import { RECENT_COMMANDS_KEY } from "@/lib/command-data";
import { FAROSZ_BOOK, SCENE_ACTIVE } from "@/test/msw/fixtures";

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

function renderPalette() {
  return render(
    <Providers>
      <CommandPalette />
    </Providers>,
  );
}

/** Open the palette and wait for the REAL book data to populate the list. */
async function openLoaded() {
  useUIStore.getState().openCommand();
  // findAllBy — a recent row may duplicate the seeded scene's label.
  await screen.findAllByText(SCENE_ACTIVE.title);
}

/** Type into the palette input, select the row, wait for the palette to close. */
async function selectByTyping(query: string, rowLabel: string) {
  // findBy — a reopen (openCommand) needs a tick before the dialog re-mounts.
  const input = await screen.findByPlaceholderText(/Keresés a projektben/);
  await userEvent.type(input, query);
  await userEvent.click(await screen.findByText(rowLabel));
}

function stored(): unknown {
  return JSON.parse(localStorage.getItem(RECENT_COMMANDS_KEY) ?? "null");
}

describe("CommandPalette — recents", () => {
  beforeEach(() => {
    push.mockClear();
    setThemeMock.mockClear();
    localStorage.clear();
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

  it("no stored recents → no Legutóbbiak group", async () => {
    renderPalette();
    await openLoaded();
    expect(screen.queryByText(hu.command.groupRecents)).not.toBeInTheDocument();
  });

  it("selecting a scene persists the re-executable entry (storage shape pinned)", async () => {
    renderPalette();
    await openLoaded();
    await selectByTyping("Rejtett", SCENE_ACTIVE.title);

    expect(push).toHaveBeenCalledWith(
      routes.scene(FAROSZ_BOOK.id, SCENE_ACTIVE.id),
    );
    // The EXACT stored shape: label + group + the ORIGINAL route target.
    expect(stored()).toEqual([
      {
        label: SCENE_ACTIVE.title,
        group: "scenes",
        href: routes.scene(FAROSZ_BOOK.id, SCENE_ACTIVE.id),
      },
    ]);
  });

  it("reopening with an empty query shows Legutóbbiak FIRST (newest selection first); Enter re-runs the recent's REAL target", async () => {
    renderPalette();
    await openLoaded();
    // 1st selection: the scene.
    await selectByTyping("Rejtett", SCENE_ACTIVE.title);

    // 2nd selection: the codex entry (newest — must end up first).
    useUIStore.getState().openCommand();
    await screen.findByText(hu.command.groupRecents); // recents already visible
    await selectByTyping("szelene", "Szelene");

    // 3rd open, EMPTY query.
    useUIStore.getState().openCommand();
    const recentsHeader = await screen.findByText(hu.command.groupRecents);
    // The scenes group needs the (cached) tree query's render tick — findBy.
    const scenesHeader = await screen.findByText(hu.command.groupScenes);
    // The recents group renders BEFORE the default groups.
    expect(
      recentsHeader.compareDocumentPosition(scenesHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const options = screen.getAllByRole("option");
    expect(options[0].textContent).toContain("Szelene");
    expect(options[1].textContent).toContain(SCENE_ACTIVE.title);

    // Enter on the first (active) row: the recent re-executes its ORIGINAL
    // codex target — exact route, mutation-checked.
    push.mockClear();
    const input = screen.getByPlaceholderText(/Keresés a projektben/);
    input.focus();
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      `${routes.book(FAROSZ_BOOK.id, "codex")}?entry=codex-szelene`,
    );
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("selecting the same result twice keeps ONE entry (dedup by label)", async () => {
    renderPalette();
    await openLoaded();
    await selectByTyping("Rejtett", SCENE_ACTIVE.title);
    useUIStore.getState().openCommand();
    await selectByTyping("Rejtett", SCENE_ACTIVE.title);

    const entries = stored() as Array<{ label: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe(SCENE_ACTIVE.title);
  });

  it("typing a query hides the recents group (recents are empty-query only)", async () => {
    localStorage.setItem(
      RECENT_COMMANDS_KEY,
      JSON.stringify([{ label: "Valami", group: "actions", action: "theme" }]),
    );
    renderPalette();
    await openLoaded();
    expect(screen.getByText(hu.command.groupRecents)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Keresés a projektben/);
    await userEvent.type(input, "Rejtett");
    expect(screen.queryByText(hu.command.groupRecents)).not.toBeInTheDocument();
  });

  it("a STALE recent (deleted scene) still navigates to its stored route without crashing", async () => {
    const staleHref = routes.scene(FAROSZ_BOOK.id, "scene-mar-torolve");
    localStorage.setItem(
      RECENT_COMMANDS_KEY,
      JSON.stringify([
        { label: "Törölt jelenet", group: "scenes", href: staleHref },
      ]),
    );
    renderPalette();
    await openLoaded();
    await userEvent.click(screen.getByText("Törölt jelenet"));
    expect(push).toHaveBeenCalledWith(staleHref);
    expect(useUIStore.getState().commandOpen).toBe(false);
  });

  it("malformed storage is tolerated: default groups render, no recents group", async () => {
    localStorage.setItem(RECENT_COMMANDS_KEY, "{nem json ez");
    renderPalette();
    await openLoaded();
    expect(screen.getByText(hu.command.groupScenes)).toBeInTheDocument();
    expect(screen.queryByText(hu.command.groupRecents)).not.toBeInTheDocument();
  });

  it("a11y: the open palette WITH a recents group has no violations", async () => {
    localStorage.setItem(
      RECENT_COMMANDS_KEY,
      JSON.stringify([
        { label: "Szelene", group: "codex", href: "/konyv/x/codex?entry=c1" },
        { label: "Téma váltása", group: "actions", action: "theme" },
      ]),
    );
    renderPalette();
    await openLoaded();
    expect(screen.getByText(hu.command.groupRecents)).toBeInTheDocument();
    await expectNoA11yViolations(document);
  });
});
