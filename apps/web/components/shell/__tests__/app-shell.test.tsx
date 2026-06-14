import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/kit/tooltip";
import { useUIStore } from "@/lib/stores/ui-store";

const push = vi.fn();
let pathname = "/konyv/demo/terv";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

import { AppShell } from "../app-shell";

function renderShell() {
  return render(
    <TooltipProvider>
      <AppShell>
        <div data-testid="screen-content">screen</div>
      </AppShell>
    </TooltipProvider>,
  );
}

describe("AppShell sidebar derivation", () => {
  beforeEach(() => {
    push.mockClear();
    useUIStore.setState({ openMenu: null, commandOpen: false, sparkActive: false });
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
});
