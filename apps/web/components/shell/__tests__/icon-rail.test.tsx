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

import { IconRail } from "../icon-rail";

function renderRail(activeSegment: Parameters<typeof IconRail>[0]["activeSegment"]) {
  return render(
    <TooltipProvider>
      <IconRail bookId="demo" activeSegment={activeSegment} />
    </TooltipProvider>,
  );
}

describe("IconRail", () => {
  beforeEach(() => {
    push.mockClear();
    pathname = "/konyv/demo/terv";
    useUIStore.setState({ openMenu: null, commandOpen: false, sparkActive: false });
  });

  afterEach(() => {
    useUIStore.getState().clearSpark();
  });

  it("renders the primary workspace items", () => {
    renderRail("terv");
    expect(screen.getByRole("button", { name: "Áttekintés" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terv" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Írás" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Codex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("marks the active item from the active segment", () => {
    renderRail("codex");
    const codex = screen.getByRole("button", { name: "Codex" });
    expect(codex).toHaveAttribute("aria-current", "page");
    expect(codex.className).toContain("bg-accent-muted");

    const terv = screen.getByRole("button", { name: "Terv" });
    expect(terv).not.toHaveAttribute("aria-current");
  });

  it("navigates and fires the sparkfield on item click", async () => {
    renderRail("terv");
    await userEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(push).toHaveBeenCalledWith("/konyv/demo/codex");
    expect(useUIStore.getState().sparkActive).toBe(true);
  });

  it("Írás navigates to the scene route", async () => {
    renderRail("terv");
    await userEvent.click(screen.getByRole("button", { name: "Írás" }));
    expect(push).toHaveBeenCalledWith("/konyv/demo/iras/demo");
  });

  it("opens the Tools flyout and navigates from it", async () => {
    renderRail("terv");
    await userEvent.click(screen.getByRole("button", { name: "Eszközök" }));
    const prompts = await screen.findByText("Prompt Library");
    await userEvent.click(prompts);
    expect(push).toHaveBeenCalledWith("/konyv/demo/promptok");
  });
});
