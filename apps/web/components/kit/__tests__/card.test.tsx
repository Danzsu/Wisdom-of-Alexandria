import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "@/components/kit/card";

describe("Card", () => {
  it("applies the base surface/border/radius/shadow classes", () => {
    render(<Card>tartalom</Card>);
    const card = screen.getByText("tartalom");
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("border-border");
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("shadow-card");
  });

  it("applies the interactive hover-lift modifier", () => {
    render(<Card interactive>x</Card>);
    expect(screen.getByText("x").className).toContain("hover:-translate-y-0.5");
  });

  it("applies the selected ring + accent-muted modifier", () => {
    render(<Card selected>x</Card>);
    const card = screen.getByText("x");
    expect(card.className).toContain("ring-2");
    expect(card.className).toContain("ring-accent");
    expect(card.className).toContain("bg-accent-muted");
  });

  it("applies the accent-edge left border", () => {
    render(<Card accentEdge="ai">x</Card>);
    expect(screen.getByText("x").className).toContain("border-l-ai");
  });

  it("renders a cover-top header slot and the body separately", () => {
    render(
      <Card coverTop={<span data-testid="cover" />}>
        <span data-testid="body" />
      </Card>,
    );
    expect(screen.getByTestId("cover")).toBeInTheDocument();
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });
});
