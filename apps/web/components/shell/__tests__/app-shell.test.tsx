import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Providers } from "@/test/test-utils";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEditorStore } from "@/lib/stores/editor-store";

const push = vi.fn();
let pathname = "/konyv/demo/terv";
// The Write route's ChapterTree + StatusBar read params; default has no sceneId.
let params: Record<string, string | undefined> = { bookId: "demo" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => pathname,
  useParams: () => params,
  // The Codex sidebar reads the selected entry from the URL search params.
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

import { AppShell } from "../app-shell";
import { HOW_IT_WORKS_KEY } from "@/components/onboarding/how-it-works";

function renderShell() {
  // ChapterTree + StatusBar now fetch via TanStack Query, so the shell needs a
  // QueryClient (provided by the shared test Providers) plus the Toaster/Tooltip.
  return render(
    <Providers>
      <AppShell>
        <div data-testid="screen-content">screen</div>
      </AppShell>
    </Providers>,
  );
}

describe("AppShell sidebar derivation", () => {
  beforeEach(() => {
    push.mockClear();
    params = { bookId: "demo" };
    useUIStore.setState({
      openMenu: null,
      commandOpen: false,
      sparkActive: false,
      howItWorksOpen: false,
    });
    useEditorStore.setState({ focusOn: false });
    // Mark the onboarding narrative as already seen so the first-run trigger
    // doesn't auto-open its overlay during these shell-layout assertions.
    window.localStorage.setItem(HOW_IT_WORKS_KEY, "1");
  });

  afterEach(() => {
    useUIStore.getState().clearSpark();
  });

  it("renders the route children in the main area", () => {
    pathname = "/konyv/demo/terv";
    renderShell();
    expect(screen.getByTestId("screen-content")).toBeInTheDocument();
  });

  it("default book route mounts the icon rail (not tree/codex)", () => {
    pathname = "/konyv/demo/terv";
    renderShell();
    expect(screen.getByRole("navigation", { name: "Munkaterület" })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Fejezetek" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Codex" }),
    ).not.toBeInTheDocument();
  });

  it("Write route mounts the chapter tree + StatusBar, not the rail", () => {
    pathname = "/konyv/demo/iras/demo";
    params = { bookId: "demo", sceneId: "demo" };
    renderShell();
    expect(screen.getByRole("navigation", { name: "Fejezetek" })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Munkaterület" }),
    ).not.toBeInTheDocument();
    // StatusBar only on Write.
    expect(screen.getByText("Mentve")).toBeInTheDocument();
    // AI inspector slot reserved.
    expect(screen.getByRole("complementary", { name: "AI segéd" })).toBeInTheDocument();
  });

  it("Codex route mounts the codex sidebar", () => {
    pathname = "/konyv/demo/codex";
    renderShell();
    expect(screen.getByRole("navigation", { name: "Codex" })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Munkaterület" }),
    ).not.toBeInTheDocument();
  });

  it("projects picker hides all sidebars and the StatusBar", () => {
    pathname = "/projekt";
    renderShell();
    expect(
      screen.queryByRole("navigation", { name: "Munkaterület" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Mentve")).not.toBeInTheDocument();
    // TopBar still present.
    expect(screen.getByRole("button", { name: "Projektek" })).toBeInTheDocument();
  });

  it("StatusBar does not render off the Write route", () => {
    pathname = "/konyv/demo/terv";
    renderShell();
    expect(screen.queryByText("Mentve")).not.toBeInTheDocument();
  });

  // ---- Focus mode (Fix 4): hides the distracting chrome on the Write route ----
  it("focus mode hides the chrome on the Write route (TopBar, tree, inspector, StatusBar)", () => {
    pathname = "/konyv/demo/iras/demo";
    params = { bookId: "demo", sceneId: "demo" };
    useEditorStore.setState({ focusOn: true });
    renderShell();

    // Chrome is hidden…
    expect(
      screen.queryByRole("navigation", { name: "Fejezetek" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "AI segéd" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Mentve")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Projektek" }),
    ).not.toBeInTheDocument();
    // …but the manuscript area (route children) stays.
    expect(screen.getByTestId("screen-content")).toBeInTheDocument();
  });

  it("focus mode chrome returns when focus is off", () => {
    pathname = "/konyv/demo/iras/demo";
    params = { bookId: "demo", sceneId: "demo" };
    useEditorStore.setState({ focusOn: false });
    renderShell();
    expect(
      screen.getByRole("navigation", { name: "Fejezetek" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mentve")).toBeInTheDocument();
  });

  it("Esc exits focus mode", () => {
    pathname = "/konyv/demo/iras/demo";
    params = { bookId: "demo", sceneId: "demo" };
    useEditorStore.setState({ focusOn: true });
    renderShell();
    expect(useEditorStore.getState().focusOn).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(useEditorStore.getState().focusOn).toBe(false);
  });

  it("focus mode does NOT hide chrome off the Write route", () => {
    pathname = "/konyv/demo/terv";
    useEditorStore.setState({ focusOn: true });
    renderShell();
    // focusOn only applies on Write — the rail still shows here.
    expect(
      screen.getByRole("navigation", { name: "Munkaterület" }),
    ).toBeInTheDocument();
  });
});
