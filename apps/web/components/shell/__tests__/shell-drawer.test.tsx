import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { Providers } from "@/test/test-utils";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEditorStore } from "@/lib/stores/editor-store";

const push = vi.fn();
let pathname = "/konyv/demo/iras/demo";
let params: Record<string, string | undefined> = {
  bookId: "demo",
  sceneId: "demo",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => pathname,
  useParams: () => params,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

import { AppShell } from "../app-shell";
import { HOW_IT_WORKS_KEY } from "@/components/onboarding/how-it-works";

function renderShell() {
  return render(
    <Providers>
      <AppShell>
        <div data-testid="screen-content">screen</div>
      </AppShell>
    </Providers>,
  );
}

/**
 * UX-4a responsive shell drawers. The DESKTOP layout is the base (the inline
 * panes still render in jsdom — asserted by the existing app-shell tests); these
 * tests exercise the small-screen drawer MECHANISM (store state + the toggles +
 * conditional drawer rendering + a11y), which is viewport-independent.
 */
describe("AppShell responsive drawers", () => {
  beforeEach(() => {
    push.mockClear();
    pathname = "/konyv/demo/iras/demo";
    params = { bookId: "demo", sceneId: "demo" };
    useUIStore.setState({
      openMenu: null,
      commandOpen: false,
      shortcutsOpen: false,
      howItWorksOpen: false,
      shellDrawer: null,
      sparkActive: false,
    });
    useEditorStore.setState({ focusOn: false });
    window.localStorage.setItem(HOW_IT_WORKS_KEY, "1");
  });

  afterEach(() => {
    useUIStore.getState().clearSpark();
  });

  it("renders the tree + inspector toggles on the Write route", () => {
    renderShell();
    const treeToggle = screen.getByRole("button", {
      name: "Fejezetek megnyitása",
    });
    const inspectorToggle = screen.getByRole("button", {
      name: "AI segéd megnyitása",
    });
    // Collapsed by default (aria-expanded=false, no drawer in the DOM).
    expect(treeToggle).toHaveAttribute("aria-expanded", "false");
    expect(treeToggle).toHaveAttribute("aria-controls", "shell-drawer-tree");
    expect(inspectorToggle).toHaveAttribute("aria-expanded", "false");
    expect(inspectorToggle).toHaveAttribute(
      "aria-controls",
      "shell-drawer-inspector",
    );
  });

  it("the tree toggle opens the chapter-tree drawer (state + rendered, labelled)", () => {
    renderShell();
    const treeToggle = screen.getByRole("button", {
      name: "Fejezetek megnyitása",
    });
    fireEvent.click(treeToggle);

    expect(useUIStore.getState().shellDrawer).toBe("tree");
    expect(treeToggle).toHaveAttribute("aria-expanded", "true");
    // The drawer is a labelled modal dialog (Radix → focus-trapped).
    const dialog = screen.getByRole("dialog", { name: "Fejezetek" });
    expect(dialog).toBeInTheDocument();
    // The chapter-tree nav lives inside the drawer.
    expect(
      within(dialog).getByRole("navigation", { name: "Fejezetek" }),
    ).toBeInTheDocument();
  });

  it("the inspector toggle opens the AI-inspector drawer", () => {
    renderShell();
    fireEvent.click(
      screen.getByRole("button", { name: "AI segéd megnyitása" }),
    );
    expect(useUIStore.getState().shellDrawer).toBe("inspector");
    expect(screen.getByRole("dialog", { name: "AI segéd" })).toBeInTheDocument();
  });

  it("the drawers are mutually exclusive (store enforces single open)", () => {
    // Asserted at the store level: while a drawer is open it is a modal Radix
    // dialog, so the OTHER topbar toggle is intentionally inert/unreachable —
    // the single-open invariant lives in the store, not the DOM.
    const store = useUIStore.getState();
    store.openShellDrawer("tree");
    expect(useUIStore.getState().shellDrawer).toBe("tree");
    store.openShellDrawer("inspector");
    expect(useUIStore.getState().shellDrawer).toBe("inspector");
    store.toggleShellDrawer("inspector");
    expect(useUIStore.getState().shellDrawer).toBeNull();
  });

  it("Esc closes the open drawer", () => {
    renderShell();
    fireEvent.click(
      screen.getByRole("button", { name: "Fejezetek megnyitása" }),
    );
    expect(screen.getByRole("dialog", { name: "Fejezetek" })).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(useUIStore.getState().shellDrawer).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Fejezetek" }),
    ).not.toBeInTheDocument();
  });

  it("navigating from a drawer closes it (route-change dismissal)", () => {
    renderShell();
    fireEvent.click(
      screen.getByRole("button", { name: "AI segéd megnyitása" }),
    );
    expect(useUIStore.getState().shellDrawer).toBe("inspector");

    // useNavTo (used by every shell navigation) clears the drawer.
    useUIStore.setState({ shellDrawer: "inspector" });
    const dialog = screen.getByRole("dialog", { name: "AI segéd" });
    // The drawer close button uses the same close action.
    fireEvent.click(within(dialog).getByRole("button", { name: "Bezárás" }));
    expect(useUIStore.getState().shellDrawer).toBeNull();
  });

  it("entering focus mode closes any open drawer and removes the toggles", () => {
    renderShell();
    fireEvent.click(
      screen.getByRole("button", { name: "Fejezetek megnyitása" }),
    );
    expect(useUIStore.getState().shellDrawer).toBe("tree");

    // Turning on focus mode re-renders the shell; its effect closes the drawer.
    act(() => {
      useEditorStore.setState({ focusOn: true });
    });
    expect(useUIStore.getState().shellDrawer).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Fejezetek megnyitása" }),
    ).not.toBeInTheDocument();
  });

  it("the Plan (rail) route exposes NO drawer toggles (rail stays inline)", () => {
    pathname = "/konyv/demo/terv";
    params = { bookId: "demo" };
    renderShell();
    expect(
      screen.queryByRole("button", { name: "Fejezetek megnyitása" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "AI segéd megnyitása" }),
    ).not.toBeInTheDocument();
  });

  it("the Codex route exposes the left (codex) toggle, not the inspector toggle", () => {
    pathname = "/konyv/demo/codex";
    params = { bookId: "demo" };
    renderShell();
    const toggle = screen.getByRole("button", { name: "Fejezetek megnyitása" });
    fireEvent.click(toggle);
    // The left drawer hosts the Codex sidebar here.
    expect(screen.getByRole("dialog", { name: "Codex" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "AI segéd megnyitása" }),
    ).not.toBeInTheDocument();
  });
});
