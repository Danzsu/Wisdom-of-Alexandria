import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/kit/button";

const VARIANTS = [
  "cta",
  "secondary",
  "ghost",
  "success",
  "destructive",
  "accent-outline",
  "dashed",
] as const;

describe("Button", () => {
  it("renders every variant with a label", () => {
    for (const variant of VARIANTS) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole("button", { name: variant })).toBeInTheDocument();
      unmount();
    }
  });

  it("applies the cta token classes", () => {
    render(<Button variant="cta">Mentés</Button>);
    const btn = screen.getByRole("button", { name: "Mentés" });
    expect(btn.className).toContain("bg-accent-strong");
    expect(btn.className).toContain("text-accent-fg");
  });

  it("carries the shared base classes and the data-press hook", () => {
    render(<Button>X</Button>);
    const btn = screen.getByRole("button", { name: "X" });
    expect(btn).toHaveAttribute("data-press", "");
    expect(btn.className).toContain("inline-flex");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("adds the gold-sweep class only when sweep is set", () => {
    const { rerender } = render(<Button variant="cta">A</Button>);
    expect(screen.getByRole("button").className).not.toContain("woa-cta");
    rerender(
      <Button variant="cta" sweep>
        A
      </Button>,
    );
    expect(screen.getByRole("button").className).toContain("woa-cta");
  });

  it("renders leading and trailing icon slots", () => {
    render(
      <Button
        leadingIcon={<span data-testid="lead" />}
        trailingIcon={<span data-testid="trail" />}
      >
        Label
      </Button>,
    );
    expect(screen.getByTestId("lead")).toBeInTheDocument();
    expect(screen.getByTestId("trail")).toBeInTheDocument();
  });
});
