import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, StatusPill } from "@/components/kit/badge";

describe("Badge / StatusPill", () => {
  it("renders an automatic colour dot when no icon is supplied (never colour-only)", () => {
    const { container } = render(<Badge variant="success">Kész</Badge>);
    // The guard dot is an aria-hidden span with a rounded background class.
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain("rounded-full");
    expect(dot?.className).toContain("bg-success");
  });

  it("uses the supplied icon instead of the auto dot", () => {
    const { container } = render(
      <Badge variant="ai" icon={<span data-testid="glyph" />}>
        AI
      </Badge>,
    );
    expect(screen.getByTestId("glyph")).toBeInTheDocument();
    // No auto dot when an explicit icon is given.
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
  });

  it("applies tokenised variant classes", () => {
    render(<Badge variant="pov3">POV3</Badge>);
    const badge = screen.getByText("POV3");
    expect(badge.className).toContain("bg-pov3-bg");
    expect(badge.className).toContain("text-pov3-tx");
  });

  it("StatusPill is the same primitive", () => {
    expect(StatusPill).toBe(Badge);
  });
});
