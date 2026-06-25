import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CelestialBackdrop } from "@/components/kit/celestial-backdrop";

describe("CelestialBackdrop", () => {
  it("renders a decorative layer that is aria-hidden and non-interactive", () => {
    const { container } = render(<CelestialBackdrop />);
    const layer = container.querySelector("[data-celestial-backdrop]");
    expect(layer).toBeInTheDocument();
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none");
    expect(layer).toHaveClass("absolute");
  });

  it("renders the requested number of stars (default 18)", () => {
    const { container } = render(<CelestialBackdrop />);
    const stars = container.querySelectorAll("[data-celestial-backdrop] > span");
    expect(stars).toHaveLength(18);
  });

  it("honours the density prop", () => {
    const { container } = render(<CelestialBackdrop density={6} />);
    expect(
      container.querySelectorAll("[data-celestial-backdrop] > span"),
    ).toHaveLength(6);
  });

  it("caps star count at 24 even for large density", () => {
    const { container } = render(<CelestialBackdrop density={500} />);
    expect(
      container.querySelectorAll("[data-celestial-backdrop] > span"),
    ).toHaveLength(24);
  });

  it("produces a stable (deterministic) layout for a given density", () => {
    const first = render(<CelestialBackdrop density={10} />);
    const a = Array.from(
      first.container.querySelectorAll<HTMLElement>(
        "[data-celestial-backdrop] > span",
      ),
    ).map((el) => el.getAttribute("style"));
    first.unmount();

    const second = render(<CelestialBackdrop density={10} />);
    const b = Array.from(
      second.container.querySelectorAll<HTMLElement>(
        "[data-celestial-backdrop] > span",
      ),
    ).map((el) => el.getAttribute("style"));

    expect(a).toEqual(b);
  });

  it("applies the className and opacity props to the layer", () => {
    const { container } = render(
      <CelestialBackdrop className="-top-8" opacity={0.5} />,
    );
    const layer = container.querySelector<HTMLElement>(
      "[data-celestial-backdrop]",
    );
    expect(layer).toHaveClass("-top-8");
    expect(layer?.style.opacity).toBe("0.5");
  });

  it("uses only brand token tints (no raw hex) for star fills", () => {
    const { container } = render(<CelestialBackdrop density={9} />);
    const stars = container.querySelectorAll<HTMLElement>(
      "[data-celestial-backdrop] > span",
    );
    for (const star of stars) {
      expect(star.style.backgroundColor).toMatch(/^var\(--(gold|accent|text-faint)\)$/);
    }
  });
});
