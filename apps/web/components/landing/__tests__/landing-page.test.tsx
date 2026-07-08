import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { hu } from "@/lib/i18n/hu";

/**
 * next/link renders a real <a href> in jsdom, so the CTA navigation target is
 * asserted directly off the anchor's href (no router mock needed for that).
 * useTheme is mocked so we can assert the toggle calls setTheme with the
 * flipped value.
 */
const setTheme = vi.fn();
let resolvedTheme = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

import { LandingPage } from "../landing-page";
import { PARALLAX_FACTOR } from "../use-landing-motion";

function renderPage() {
  return render(
    <Providers>
      <LandingPage />
    </Providers>,
  );
}

/* ── deterministic rAF harness for the motion-wiring tests ──────────────── */

let rafQueue: Map<number, FrameRequestCallback>;
let rafSeq = 0;

/** Replace rAF with a manual queue; call BEFORE renderPage(). */
function stubRaf() {
  rafQueue = new Map();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.set(++rafSeq, cb);
    return rafSeq;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue.delete(id);
  });
}

/** Run `n` animation frames. */
function frame(n = 1) {
  for (let i = 0; i < n; i++) {
    const pending = [...rafQueue.values()];
    rafQueue.clear();
    for (const cb of pending) cb(16 * (i + 1));
  }
}

function pointerMove(el: Element, clientX: number, clientY: number) {
  el.dispatchEvent(
    new MouseEvent("pointermove", { clientX, clientY, bubbles: true }),
  );
}

/** Force `matchMedia` to report reduced motion; call BEFORE renderPage(). */
function stubReducedMotion() {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

function setScrollY(value: number) {
  Object.defineProperty(globalThis, "scrollY", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("LandingPage", () => {
  beforeEach(() => {
    setTheme.mockClear();
    resolvedTheme = "light";
    // jsdom has no scrollIntoView; the smooth-scroll handler calls it.
    Element.prototype.scrollIntoView = vi.fn();
    // jsdom does not implement canvas getContext (it warns + returns null).
    // The embers canvas already guards on a null context — stub it to null so
    // that guard is exercised and the test output stays free of jsdom noise.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setScrollY(0);
  });

  it("renders the hero headline and all four pillar titles", () => {
    renderPage();
    // Hero headline (split across spans) — the first line is unique.
    expect(
      screen.getByText(hu.landing.heroTitleLine1, { exact: false }),
    ).toBeInTheDocument();
    // Each pillar title is present.
    for (const pillar of hu.landing.pillars) {
      expect(
        screen.getByRole("heading", { name: pillar.title }),
      ).toBeInTheDocument();
    }
  });

  it("the primary 'Belépés a műhelybe' control targets /projekt", () => {
    renderPage();
    // The nav CTA is a link to the app entry point.
    const ctas = screen.getAllByRole("link", { name: hu.landing.enterApp });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/projekt");
    }
    // The hero "Kezdj el írni" CTA also enters the app.
    expect(
      screen.getByRole("link", { name: hu.landing.heroCtaPrimary }),
    ).toHaveAttribute("href", "/projekt");
  });

  it("the brand wordmark link also enters the app at /projekt", () => {
    renderPage();
    // The nav brand lockup is an accessible link (the footer brand is not a
    // link) — it must lead to the app entry point like the CTAs.
    expect(
      screen.getByRole("link", { name: hu.landing.brandAria }),
    ).toHaveAttribute("href", "/projekt");
  });

  it("the theme toggle flips the theme via setTheme", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      screen.getByRole("button", { name: hu.landing.themeToggleAria }),
    );
    // light → dark.
    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("'Nézd meg élőben' smooth-scrolls to the showcase section", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const showcase = container.querySelector("#muhely");
    expect(showcase).not.toBeNull();
    const spy = vi.spyOn(showcase as Element, "scrollIntoView");

    await user.click(
      screen.getByRole("button", { name: hu.landing.heroCtaSecondary }),
    );
    expect(spy).toHaveBeenCalled();
  });

  it("exposes proper landmarks and the three anchor sections", () => {
    const { container } = renderPage();
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector("nav")).not.toBeNull();
    expect(container.querySelector("main")).not.toBeNull();
    expect(container.querySelector("footer")).not.toBeNull();
    expect(container.querySelector("#funkciok")).not.toBeNull();
    expect(container.querySelector("#muhely")).not.toBeNull();
    expect(container.querySelector("#elv")).not.toBeNull();
  });

  it("renders the nav anchor links pointing at their sections", () => {
    renderPage();
    const nav = screen.getByRole("navigation");
    expect(
      within(nav).getByRole("link", { name: hu.landing.navFeatures }),
    ).toHaveAttribute("href", "#funkciok");
    expect(
      within(nav).getByRole("link", { name: hu.landing.navWorkshop }),
    ).toHaveAttribute("href", "#muhely");
    expect(
      within(nav).getByRole("link", { name: hu.landing.navPhilosophy }),
    ).toHaveAttribute("href", "#elv");
  });

  it("has no a11y violations", async () => {
    const { container } = renderPage();
    await expectNoA11yViolations(container);
  });

  /* ── motion polish wiring (magnetic / tilt / parallax / stagger) ──────── */

  it("reveals the pillar grid as a stagger group — parent trigger, no per-card reveal", () => {
    const { container } = renderPage();
    const grid = container.querySelector(".woa-land-stagger");
    expect(grid).not.toBeNull();
    // The PARENT carries the reveal trigger…
    expect(grid).toHaveAttribute("data-reveal");
    // …over exactly the four pillar cards…
    expect(grid?.children).toHaveLength(hu.landing.pillars.length);
    // …and the cards are no longer individually revealed.
    expect(grid?.querySelector("[data-reveal]")).toBeNull();
  });

  it("the nav, hero and footer CTAs are magnetic (pointer-follow transform)", () => {
    stubRaf();
    renderPage();
    const targets = [
      // nav + footer "Belépés a műhelybe"
      ...screen.getAllByRole("link", { name: hu.landing.enterApp }),
      // hero gold "Kezdj el írni"
      screen.getByRole("link", { name: hu.landing.heroCtaPrimary }),
    ] as HTMLElement[];
    expect(targets).toHaveLength(3);
    for (const cta of targets) {
      pointerMove(cta, 40, 20);
      frame(1);
      expect(cta.style.transform).toMatch(/^translate\(/);
    }
  });

  it("pointer over the hero section tilts the floating editor mock", () => {
    stubRaf();
    const { container } = renderPage();
    const tilt = container.querySelector<HTMLElement>("[data-hero-tilt]");
    expect(tilt).not.toBeNull();
    const zone = tilt?.closest("section");
    expect(zone).not.toBeNull();
    pointerMove(zone as Element, 120, 60);
    frame(1);
    expect(tilt?.style.transform).toMatch(
      /^rotateY\(-?[\d.]+deg\) rotateX\(-?[\d.]+deg\)$/,
    );
  });

  it("the hero glow parallaxes at a fraction of the scroll offset", () => {
    stubRaf();
    setScrollY(200);
    const { container } = renderPage();
    const glow = container.querySelector<HTMLElement>("[data-hero-glow]");
    expect(glow).not.toBeNull();
    // Applied once on mount (mid-page reload)…
    expect(glow?.style.transform).toBe(
      `translate3d(0,${(200 * PARALLAX_FACTOR).toFixed(1)}px,0)`,
    );
    // …and follows subsequent scrolling via rAF.
    setScrollY(400);
    globalThis.dispatchEvent(new Event("scroll"));
    frame(1);
    expect(glow?.style.transform).toBe(
      `translate3d(0,${(400 * PARALLAX_FACTOR).toFixed(1)}px,0)`,
    );
  });

  it("under reduced motion no JS transform is ever applied and content stays visible", () => {
    stubRaf();
    stubReducedMotion();
    setScrollY(200);
    const { container } = renderPage();

    // Magnetic CTA: inert.
    const cta = screen.getByRole("link", {
      name: hu.landing.heroCtaPrimary,
    }) as HTMLElement;
    pointerMove(cta, 40, 20);
    frame(3);
    expect(cta.style.transform).toBe("");

    // Hero tilt: inert.
    const tilt = container.querySelector<HTMLElement>("[data-hero-tilt]");
    pointerMove(tilt?.closest("section") as Element, 120, 60);
    frame(3);
    expect(tilt?.style.transform).toBe("");

    // Parallax glow: inert.
    expect(
      container.querySelector<HTMLElement>("[data-hero-glow]")?.style
        .transform,
    ).toBe("");

    // Reveal contract: everything is shown immediately (no hidden stagger).
    for (const pillar of hu.landing.pillars) {
      expect(
        screen.getByRole("heading", { name: pillar.title }),
      ).toBeInTheDocument();
    }
    expect(
      container.querySelector(".woa-land-stagger"),
    ).toHaveAttribute("data-reveal-in");
  });
});
