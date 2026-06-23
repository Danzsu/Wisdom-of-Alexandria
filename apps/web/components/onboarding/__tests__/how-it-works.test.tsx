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
 * whether the GSAP scroll path may run; under reduce it must render the plain
 * static stack with no GSAP registration.
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

describe("HowItWorks", () => {
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

  it("renders all four panels' headings and copy when open (static path)", async () => {
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();

    // Dialog is titled + described (Radix requires both).
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(hu.howItWorks.title);
    expect(dialog).toHaveAccessibleDescription(/négy lépésben/i);

    for (const panel of hu.howItWorks.panels) {
      expect(screen.getByText(panel.title)).toBeInTheDocument();
      expect(screen.getByText(panel.body)).toBeInTheDocument();
      expect(screen.getByText(panel.kicker)).toBeInTheDocument();
    }
  });

  it("does NOT render when the store flag is closed", () => {
    render(<HowItWorks />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("skip ('Kihagyás') sets the localStorage flag and closes", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: hu.howItWorks.skipAria }));

    expect(window.localStorage.getItem(HOW_IT_WORKS_KEY)).toBe("1");
    expect(useUIStore.getState().howItWorksOpen).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("close (X) also persists the dismissal flag", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: hu.howItWorks.closeAria }));

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

  it("renders the static stack and does not crash under reduced motion", async () => {
    mockReducedMotion(true);
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();

    await screen.findByRole("dialog");
    // All four panels are present (the static fallback is the a11y baseline).
    for (const panel of hu.howItWorks.panels) {
      expect(screen.getByText(panel.title)).toBeInTheDocument();
    }
    // The scroll hint is hidden under reduced motion (no scroll affordance).
    expect(screen.queryByText(hu.howItWorks.scrollHint)).not.toBeInTheDocument();
  });

  it("shows the scroll hint when motion is allowed", async () => {
    render(<HowItWorks />);
    useUIStore.getState().openHowItWorks();
    await screen.findByRole("dialog");
    expect(screen.getByText(hu.howItWorks.scrollHint)).toBeInTheDocument();
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

  it("the modal title is NOT in the document on first-run mount (no stacking)", () => {
    render(
      <>
        <HowItWorksFirstRun />
        <HowItWorks />
      </>,
    );
    // Before any user interaction, the dialog heading must be absent —
    // no modal-on-banner stacking on `/projekt` first load.
    expect(screen.queryByText(hu.howItWorks.title)).not.toBeInTheDocument();
  });

  it("the modal opens when triggered manually via the store (on-demand path)", async () => {
    render(
      <>
        <HowItWorksFirstRun />
        <HowItWorks />
      </>,
    );
    expect(screen.queryByText(hu.howItWorks.title)).not.toBeInTheDocument();

    // Simulate the help button click (which calls openHowItWorks on the store).
    useUIStore.getState().openHowItWorks();
    expect(await screen.findByText(hu.howItWorks.title)).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: hu.howItWorks.skipAria }));
    expect(window.localStorage.getItem(HOW_IT_WORKS_KEY)).toBe("1");

    // Simulate a fresh mount: must still NOT auto-open.
    useUIStore.setState({ howItWorksOpen: false });
    render(<HowItWorksFirstRun />);
    expect(useUIStore.getState().howItWorksOpen).toBe(false);
  });
});
