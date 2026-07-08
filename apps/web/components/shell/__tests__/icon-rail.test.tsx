import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEditorStore } from "@/lib/stores/editor-store";
import { FAROSZ_BOOK, SCENE_FIRST } from "@/test/msw/fixtures";

const push = vi.fn();
let pathname = "/konyv/demo/terv";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

import { IconRail } from "../icon-rail";

function renderRail(
  activeSegment: Parameters<typeof IconRail>[0]["activeSegment"],
  bookId = FAROSZ_BOOK.id,
) {
  // IconRail now calls useBookTree to resolve the Write destination, so it needs
  // the TanStack Query provider (renderWithProviders supplies it + MSW handlers).
  return renderWithProviders(
    <IconRail bookId={bookId} activeSegment={activeSegment} />,
  );
}

describe("IconRail", () => {
  beforeEach(() => {
    push.mockClear();
    pathname = "/konyv/demo/terv";
    useUIStore.setState({ openMenu: null, commandOpen: false, sparkActive: false });
    useEditorStore.setState({ aiFreeOn: false });
  });

  afterEach(() => {
    useUIStore.getState().clearSpark();
  });

  it("renders the prototype primary workspace items", () => {
    renderRail("terv");
    expect(screen.getByRole("button", { name: "Terv" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Írás" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Codex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kutatás" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tiszta írás" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Beállítások" }),
    ).toBeInTheDocument();
  });

  it("does NOT promote the V1 screens into the primary rail", () => {
    renderRail("terv");
    // Áttekintés / Idősor / Kapcsolatok / Cselekményszálak live in the Tools
    // flyout (proto ~243-249), not as primary rail buttons.
    expect(
      screen.queryByRole("button", { name: "Áttekintés" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Idősor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Kapcsolatok" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cselekményszálak" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces the V1 screens inside the Tools flyout", async () => {
    renderRail("terv");
    await userEvent.click(screen.getByRole("button", { name: "Eszközök" }));
    // The analysis group holds the four V1 destinations.
    expect(await screen.findByText("Áttekintés")).toBeInTheDocument();
    expect(screen.getByText("Idősor")).toBeInTheDocument();
    expect(screen.getByText("Kapcsolatok")).toBeInTheDocument();
    expect(screen.getByText("Cselekményszálak")).toBeInTheDocument();
  });

  it("highlights the Tools button when a flyout segment is active", () => {
    renderRail("idosor");
    const tools = screen.getByRole("button", { name: "Eszközök" });
    expect(tools).toHaveAttribute("aria-current", "page");
    expect(tools.className).toContain("bg-accent-muted");
  });

  it("Tiszta írás enables AI-free mode and opens the manuscript", async () => {
    renderRail("terv");
    await waitFor(() => expect(true).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Tiszta írás" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/konyv/${FAROSZ_BOOK.id}/iras/${SCENE_FIRST.id}`,
      ),
    );
    expect(useEditorStore.getState().aiFreeOn).toBe(true);
  });

  it("marks the active item from the active segment", () => {
    renderRail("codex");
    const codex = screen.getByRole("button", { name: "Codex" });
    expect(codex).toHaveAttribute("aria-current", "page");
    expect(codex.className).toContain("bg-accent-muted");

    const terv = screen.getByRole("button", { name: "Terv" });
    expect(terv).not.toHaveAttribute("aria-current");
  });

  it("shows the parchment tooltip with the item label on hover (a11y name intact)", async () => {
    renderRail("terv");
    const trigger = screen.getByRole("button", { name: "Codex" });
    await userEvent.hover(trigger);
    // Radix opens after the provider delay; findBy* waits it out. The
    // role="tooltip" node is Radix's visually-hidden aria bridge — its text is
    // what screen-readers read via aria-describedby.
    const bridge = await screen.findByRole("tooltip");
    expect(bridge).toHaveTextContent("Codex");
    // The VISIBLE content carries the parchment styling hook (.woa-tip,
    // globals.css) and sits to the RIGHT of the rail — data-side drives the
    // slide-in direction.
    const content = document.querySelector(".woa-tip");
    expect(content).not.toBeNull();
    expect(content).toHaveTextContent("Codex");
    expect(content).toHaveAttribute("data-side", "right");
    // The trigger's own aria-label stays (tooltip never replaces it).
    expect(trigger).toHaveAttribute("aria-label", "Codex");
    await userEvent.unhover(trigger);
  });

  it("navigates and fires the sparkfield on item click", async () => {
    renderRail("terv");
    await userEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(push).toHaveBeenCalledWith(`/konyv/${FAROSZ_BOOK.id}/codex`);
    expect(useUIStore.getState().sparkActive).toBe(true);
  });

  it("Írás navigates to the book's FIRST real scene (never a demo id)", async () => {
    renderRail("terv");
    // Wait for the book tree to load so the first scene is resolved.
    await waitFor(() => expect(true).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Írás" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/konyv/${FAROSZ_BOOK.id}/iras/${SCENE_FIRST.id}`,
      ),
    );
    // It must NOT navigate to a fabricated demo scene id.
    expect(push).not.toHaveBeenCalledWith(`/konyv/${FAROSZ_BOOK.id}/iras/demo`);
  });

  it("opens the Tools flyout and navigates from it", async () => {
    renderRail("terv");
    await userEvent.click(screen.getByRole("button", { name: "Eszközök" }));
    const prompts = await screen.findByText("Prompt Library");
    await userEvent.click(prompts);
    expect(push).toHaveBeenCalledWith(`/konyv/${FAROSZ_BOOK.id}/promptok`);
  });

  it("shows the failed-job count badge on AI feladatok (real count)", async () => {
    // The Fárosz book seeds one FAILED job → the badge reads "1".
    renderRail("terv", FAROSZ_BOOK.id);
    await userEvent.click(screen.getByRole("button", { name: "Eszközök" }));
    await screen.findByText("AI feladatok");
    // Accessible: the count is announced via aria-label.
    const badge = await screen.findByLabelText("1 sikertelen AI feladat");
    expect(badge).toHaveTextContent("1");
  });

  it("hides the badge AND the warning dot when there are no failed jobs", async () => {
    // A book with no seeded jobs → 0 failed → no badge, no attention dot.
    const { container } = renderRail(
      "terv",
      "00000000-0000-0000-0000-000000000000",
    );
    await userEvent.click(screen.getByRole("button", { name: "Eszközök" }));
    await screen.findByText("AI feladatok");
    // Give the jobs query a tick to settle to an empty list, then assert both
    // the count badge (aria-label) and the aria-hidden attention dot are gone.
    await waitFor(() => {
      expect(
        screen.queryByLabelText(/sikertelen AI feladat/),
      ).not.toBeInTheDocument();
    });
    expect(container.querySelector("span.bg-warning")).toBeNull();
  });
});
