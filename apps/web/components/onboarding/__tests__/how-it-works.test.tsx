import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUIStore } from "@/lib/stores/ui-store";
import { hu } from "@/lib/i18n/hu";
import {
  HowItWorks,
  HowItWorksFirstRun,
  HOW_IT_WORKS_KEY,
} from "../how-it-works";

/**
 * Set the reduced-motion media query result for the duration of a test. The
 * component reads `matchMedia("(prefers-reduced-motion: reduce)")` to decide
 * whether the step-change motion may run; under reduce it renders the steps
 * statically with no animation.
 */
function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: reduce && query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

const PANELS = hu.howItWorks.panels;

describe("HowItWorks (step carousel)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUIStore.setState({
      howItWorksOpen: false,
      commandOpen: false,
      shortcutsOpen: false,
      openMenu: null,
    });
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens on the first step only (one panel at a time)", async () => {
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();

    // Dialog is titled (by the current step's heading) + described.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(PANELS[0].title);
    expect(dialog).toHaveAccessibleDescription(/négy lépésben/i);

    // First step's copy is visible…
    expect(screen.getByText(PANELS[0].title)).toBeInTheDocument();
    expect(screen.getByText(PANELS[0].body)).toBeInTheDocument();
    expect(screen.getByText(PANELS[0].kicker)).toBeInTheDocument();
    // …and the others are NOT (carousel, not a stack).
    expect(screen.queryByText(PANELS[1].title)).not.toBeInTheDocument();
    expect(screen.queryByText(PANELS[3].title)).not.toBeInTheDocument();

    // Step counter shows 1 / 4.
    expect(
      screen.getByText(hu.howItWorks.stepCounter(1, PANELS.length)),
    ).toBeInTheDocument();
  });

  it("Next advances through every step, then the final button closes", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    // No Back on the first step.
    expect(
      screen.queryByRole("button", { name: hu.howItWorks.back }),
    ).not.toBeInTheDocument();

    // Walk forward step 1 → 4 via Next.
    for (let i = 1; i < PANELS.length; i++) {
      await user.click(screen.getByRole("button", { name: hu.howItWorks.next }));
      expect(screen.getByText(PANELS[i].title)).toBeInTheDocument();
      expect(
        screen.getByText(hu.howItWorks.stepCounter(i + 1, PANELS.length)),
      ).toBeInTheDocument();
    }

    // Last step swaps Next → finish ("Kezdjük"); clicking it closes + persists.
    const finish = screen.getByRole("button", { name: hu.howItWorks.finish });
    await user.click(finish);
    expect(useUIStore.getState().howItWorksOpen).toBe(false);
    expect(window.localStorage.getItem(HOW_IT_WORKS_KEY)).toBe("1");
  });

  it("Back returns to the previous step", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: hu.howItWorks.next }));
    expect(screen.getByText(PANELS[1].title)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: hu.howItWorks.back }));
    expect(screen.getByText(PANELS[0].title)).toBeInTheDocument();
  });

  it("dot-nav jumps directly to a step", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    // Jump straight to step 3 (1-based aria).
    await user.click(
      screen.getByRole("button", { name: hu.howItWorks.dotAria(3) }),
    );
    expect(screen.getByText(PANELS[2].title)).toBeInTheDocument();
    expect(
      screen.getByText(hu.howItWorks.stepCounter(3, PANELS.length)),
    ).toBeInTheDocument();
  });

  it("re-opening after dismissal resets to the first step", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: hu.howItWorks.next }));
    expect(screen.getByText(PANELS[1].title)).toBeInTheDocument();

    // Close, then re-open: must be back on step 1.
    await user.click(
      screen.getByRole("button", { name: hu.howItWorks.closeAria }),
    );
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");
    expect(screen.getByText(PANELS[0].title)).toBeInTheDocument();
  });

  it("does NOT render when the store flag is closed", () => {
    render(<HowItWorks />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("inline skip ('Kihagyom') sets the localStorage flag and closes", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    await user.click(
      screen.getByRole("button", { name: hu.howItWorks.skipAria }),
    );

    expect(window.localStorage.getItem(HOW_IT_WORKS_KEY)).toBe("1");
    expect(useUIStore.getState().howItWorksOpen).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("close (X) also persists the dismissal flag", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    await user.click(
      screen.getByRole("button", { name: hu.howItWorks.closeAria }),
    );

    expect(window.localStorage.getItem(HOW_IT_WORKS_KEY)).toBe("1");
    expect(useUIStore.getState().howItWorksOpen).toBe(false);
  });

  it("Esc closes the overlay (Radix Dialog) and persists the flag", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(useUIStore.getState().howItWorksOpen).toBe(false);
    expect(window.localStorage.getItem(HOW_IT_WORKS_KEY)).toBe("1");
  });

  it("renders and does not crash under reduced motion", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();

    await screen.findByRole("dialog");
    // First step renders; nav still works under reduced motion.
    expect(screen.getByText(PANELS[0].title)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: hu.howItWorks.next }));
    expect(screen.getByText(PANELS[1].title)).toBeInTheDocument();
  });
});

describe("HowItWorksFirstRun", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUIStore.setState({ howItWorksOpen: false });
    mockReducedMotion(false);
  });

  it("does NOT auto-open the modal on first run (flag unset) — banner is the sole first-run guide", () => {
    render(<HowItWorksFirstRun />);
    // The store must remain closed: the inline dashboard banner is now the
    // primary first-run affordance; the modal is on-demand only.
    expect(useUIStore.getState().howItWorksOpen).toBe(false);
  });

  it("does NOT auto-open when the dismissal flag is set", () => {
    window.localStorage.setItem(HOW_IT_WORKS_KEY, "1");
    render(<HowItWorksFirstRun />);
    expect(useUIStore.getState().howItWorksOpen).toBe(false);
  });

  it("the modal is NOT in the document on first-run mount (no stacking)", () => {
    render(
      <>
        <HowItWorksFirstRun />
        <HowItWorks />
      </>,
    );
    // Before any user interaction, the dialog must be absent —
    // no modal-on-banner stacking on `/projekt` first load.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("the modal opens when triggered manually via the store (on-demand path)", async () => {
    render(
      <>
        <HowItWorksFirstRun />
        <HowItWorks />
      </>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Simulate the help button click (which calls openHowItWorks on the store).
    useUIStore.getState().openHowItWorks();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(PANELS[0].title);
  });

  it("a dismissal persists across a remount (no re-trigger)", async () => {
    const user = userEvent.setup();
    // Open the modal manually (the on-demand path), then dismiss it.
    render(
      <>
        <HowItWorksFirstRun />
        <HowItWorks />
      </>,
    );
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");
    await user.click(
      screen.getByRole("button", { name: hu.howItWorks.skipAria }),
    );
    expect(window.localStorage.getItem(HOW_IT_WORKS_KEY)).toBe("1");

    // Simulate a fresh mount: must still NOT auto-open.
    useUIStore.setState({ howItWorksOpen: false });
    render(<HowItWorksFirstRun />);
    expect(useUIStore.getState().howItWorksOpen).toBe(false);
  });
});
