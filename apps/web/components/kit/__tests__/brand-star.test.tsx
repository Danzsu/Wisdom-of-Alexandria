import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandStar } from "@/components/kit/brand-star";
import { Swatch } from "@/components/kit/swatch";

describe("M0 foundation smoke", () => {
  it("renders the BrandStar with the gold accent fill and 8-point path", () => {
    const { container } = render(<BrandStar title="Alexandria" />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("fill", "var(--accent)");

    const path = container.querySelector("path");
    expect(path).toHaveAttribute(
      "d",
      "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z",
    );

    // The title makes it an accessible image.
    expect(screen.getByRole("img", { name: "Alexandria" })).toBeInTheDocument();
  });

  it("renders the AI sparkle variant with the 4-point path and ai fill", () => {
    const { container } = render(
      <BrandStar variant="sparkle" title="AI" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("fill", "var(--ai)");
    expect(container.querySelector("path")).toHaveAttribute(
      "d",
      "M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9Z",
    );
  });

  it("is hidden from assistive tech when decorative (no title)", () => {
    const { container } = render(<BrandStar />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("renders a token-driven Swatch with its Tailwind token class", () => {
    render(<Swatch label="accent" className="bg-accent" />);

    const chip = screen.getByTestId("swatch-accent");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass("bg-accent");
    expect(screen.getByText("accent")).toBeInTheDocument();
  });
});
