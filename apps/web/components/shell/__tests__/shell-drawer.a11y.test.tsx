/**
 * Automated accessibility (axe-core) gate for the responsive shell drawers
 * (UX-4b / UX-4a). Renders the full AppShell on the Write route, opens each
 * drawer (chapter tree + AI inspector), and scans the portalled Radix dialog
 * for violations.
 *
 * Lives in its own file because the AppShell needs the Write-route
 * `next/navigation` mock (bookId + sceneId) that the screens suite does not use.
 */
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expectNoA11yViolations } from "@/test/a11y";
import { Providers } from "@/test/test-utils";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEditorStore } from "@/lib/stores/editor-store";

const push = vi.fn();
const pathname = "/konyv/demo/iras/demo";
const params: Record<string, string | undefined> = {
  bookId: "demo",
  sceneId: "demo",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
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

describe("a11y: shell drawers (open)", () => {
  beforeEach(() => {
    push.mockClear();
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

  it("chapter-tree drawer is a labelled, accessible dialog", async () => {
    renderShell();
    fireEvent.click(
      screen.getByRole("button", { name: "Fejezetek megnyitása" }),
    );
    await screen.findByRole("dialog", { name: "Fejezetek" });
    await expectNoA11yViolations(document);
  });

  it("AI-inspector drawer is a labelled, accessible dialog", async () => {
    renderShell();
    fireEvent.click(
      screen.getByRole("button", { name: "AI segéd megnyitása" }),
    );
    await screen.findByRole("dialog", { name: "AI segéd" });
    // `landmark-unique` is scoped off for THIS scan only (documented jsdom
    // false-positive): the docked inspector (`max-lg:hidden`) and the drawer
    // copy each expose the "AI segéd" live-region landmark (AI-zone a11y
    // pass), and jsdom computes no responsive CSS, so axe sees both at once.
    // In a real browser exactly one exists per breakpoint — the drawer
    // toggles are CSS-hidden ≥ lg — so the landmarks can never coexist.
    await expectNoA11yViolations(document, {
      rules: { "landmark-unique": { enabled: false } },
    });
  });
});
