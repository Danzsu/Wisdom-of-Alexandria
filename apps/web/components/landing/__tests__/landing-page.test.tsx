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

function renderPage() {
  return render(
    <Providers>
      <LandingPage />
    </Providers>,
  );
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
});
