import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusDot } from "@/components/kit/status-dot";

describe("StatusDot — accessibility (T3)", () => {
  it("a labelled dot has role=img so the label is valid", () => {
    render(<StatusDot variant="danger" aria-label="Eredeti" />);
    expect(screen.getByRole("img", { name: "Eredeti" })).toBeInTheDocument();
  });

  it("an unlabelled dot is hidden from AT via aria-hidden", () => {
    const { container } = render(<StatusDot variant="success" />);
    expect(container.querySelector("span")).toHaveAttribute("aria-hidden", "true");
  });

  it("a labelled timeline treatment has role=img", () => {
    render(<StatusDot treatment="timeline" aria-label="Idővonal csomópont" />);
    expect(screen.getByRole("img", { name: "Idővonal csomópont" })).toBeInTheDocument();
  });

  it("an unlabelled timeline treatment is aria-hidden", () => {
    const { container } = render(<StatusDot treatment="timeline" />);
    expect(container.querySelector("span")).toHaveAttribute("aria-hidden", "true");
  });
});

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
