import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContextChips } from "@/components/kit/context-chips";

describe("ContextChips", () => {
  it("renders all entity chips even when labels are duplicated", () => {
    render(
      <ContextChips
        entities={[{ label: "Anna" }, { label: "Anna" }, { label: "Béla" }]}
      />,
    );
    // Both "Anna" chips must render; a label-based key would have collapsed
    // them to one (and warned about duplicate keys).
    expect(screen.getAllByText("Anna")).toHaveLength(2);
    expect(screen.getByText("Béla")).toBeInTheDocument();
  });

  it("renders an AI-tinted model chip after the entities when provided", () => {
    render(<ContextChips entities={[{ label: "Anna" }]} model="gemma" />);
    const model = screen.getByText("gemma");
    expect(model.className).toContain("bg-ai-muted");
  });
});
