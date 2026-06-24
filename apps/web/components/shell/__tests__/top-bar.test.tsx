import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/kit/tooltip";
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

// The model pill is config-driven (the /ai/models source the StatusBar +
// inspector use). Mock the hook so the test asserts the config value without a
// live QueryClient, and to prove no hardcoded model literal remains.
vi.mock("@/components/inspector/use-inspector-models", () => ({
  useInspectorModels: () => ({
    groups: [],
    value: "ollama/qwen2.5",
    setValue: vi.fn(),
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

// The TopBar mounts the persistent AiJobIndicator (B1 hooks → useJobs/useQuery).
// Stub the counts so the bar renders without a live QueryClient; idle by default
// means the indicator renders nothing, matching the existing assertions.
vi.mock("@/lib/api/ai-hooks", () => ({
  useActiveJobCount: () => 0,
  useFailedJobCount: () => 0,
}));

import { TopBar } from "../top-bar";

function renderTopBar(props: Partial<Parameters<typeof TopBar>[0]> = {}) {
  return render(
    <TooltipProvider>
      <TopBar
        inBook={props.inBook ?? true}
        isWrite={props.isWrite ?? false}
        bookId={props.bookId ?? "demo"}
      />
    </TooltipProvider>,
  );
}

describe("TopBar", () => {
  beforeEach(() => {
    push.mockClear();
    setThemeMock.mockClear();
    pathname = "/konyv/demo/terv";
    useUIStore.setState({ openMenu: null, commandOpen: false, sparkActive: false });
  });

  afterEach(() => {
    useUIStore.getState().clearSpark();
  });

  it("renders the brand, search, theme toggle and user menu", () => {
    renderTopBar();
    expect(screen.getByRole("button", { name: "Projektek" })).toBeInTheDocument();
    // Brand identity change: "Alexandria" → "Wisdom of Alexandria" (Caveat wordmark)
    expect(screen.getByText("Wisdom of Alexandria")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keresés" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Téma váltása" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Felhasználói menü" }),
    ).toBeInTheDocument();
    // Config-driven model pill (from the mocked useInspectorModels), not a
    // hardcoded literal.
    expect(screen.getByText("ollama/qwen2.5")).toBeInTheDocument();
  });

  it("shows the project switcher + share only in a book", () => {
    const { unmount } = renderTopBar({ inBook: true });
    expect(
      screen.getByRole("button", { name: "A Fárosz őrzője" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Megosztás" })).toBeInTheDocument();
    unmount();

    renderTopBar({ inBook: false });
    expect(
      screen.queryByRole("button", { name: "A Fárosz őrzője" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Megosztás" }),
    ).not.toBeInTheDocument();
  });

  it("shows the scene breadcrumb only on the Write route", () => {
    const { unmount } = renderTopBar({ isWrite: true });
    expect(screen.getByText("3. jelenet — Rejtett jelek")).toBeInTheDocument();
    unmount();

    renderTopBar({ isWrite: false });
    expect(
      screen.queryByText("3. jelenet — Rejtett jelek"),
    ).not.toBeInTheDocument();
  });

  it("the search button opens the command palette", async () => {
    renderTopBar();
    await userEvent.click(screen.getByRole("button", { name: "Keresés" }));
    expect(useUIStore.getState().commandOpen).toBe(true);
  });

  it("the brand navigates to the projects picker", async () => {
    renderTopBar();
    await userEvent.click(screen.getByRole("button", { name: "Projektek" }));
    expect(push).toHaveBeenCalledWith("/projekt");
  });

  it("the help button is always visible and opens the howItWorks modal", async () => {
    useUIStore.setState({ howItWorksOpen: false });
    renderTopBar({ inBook: false });
    const helpBtn = screen.getByRole("button", { name: "Hogyan működik?" });
    expect(helpBtn).toBeInTheDocument();
    await userEvent.click(helpBtn);
    expect(useUIStore.getState().howItWorksOpen).toBe(true);
  });

  it("the help button is present even inside a book", () => {
    renderTopBar({ inBook: true });
    expect(
      screen.getByRole("button", { name: "Hogyan működik?" }),
    ).toBeInTheDocument();
  });

  it("opens the user menu and fires its item actions", async () => {
    renderTopBar();
    await userEvent.click(
      screen.getByRole("button", { name: "Felhasználói menü" }),
    );
    expect(await screen.findByText("Profil")).toBeInTheDocument();
    expect(screen.getByText("Kijelentkezés")).toBeInTheDocument();
    expect(screen.getByText("lilla@alexandria.app")).toBeInTheDocument();
    // Clicking an item closes the menu (Radix selection).
    await userEvent.click(screen.getByText("Profil"));
    expect(useUIStore.getState().openMenu).toBeNull();
  });
});
