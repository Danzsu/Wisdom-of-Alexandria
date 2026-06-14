import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StatusDot } from "@/components/kit/status-dot";

describe("StatusDot", () => {
  it("applies the colour variant class", () => {
    const { container } = render(<StatusDot variant="success" />);
    expect(container.querySelector("span")?.className).toContain("bg-success");
  });

  it("renders the timeline treatment with the bg ring + outline", () => {
    const { container } = render(<StatusDot treatment="timeline" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-accent");
    expect(span?.className).toContain("border-bg");
  });

  it("renders the planned treatment with a dashed border", () => {
    const { container } = render(<StatusDot treatment="planned" />);
    expect(container.querySelector("span")?.className).toContain("border-dashed");
  });

  it("renders the presence treatment with the surface ring", () => {
    const { container } = render(
      <StatusDot treatment="presence" variant="ai" />,
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("border-surface");
    expect(span?.className).toContain("bg-ai");
  });

  it("is decorative unless given an aria-label", () => {
    const { container } = render(<StatusDot variant="danger" />);
    expect(container.querySelector("span")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
