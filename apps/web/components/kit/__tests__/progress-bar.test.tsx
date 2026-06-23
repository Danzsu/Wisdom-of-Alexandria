import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ProgressBar } from "@/components/kit/progress-bar";

describe("ProgressBar — accessibility (T2)", () => {
  it("exposes an accessible name from aria-label and sets valuetext", () => {
    render(<ProgressBar value={30} aria-label="Feltöltés" />);
    const bar = screen.getByRole("progressbar", { name: "Feltöltés" });
    expect(bar).toHaveAttribute("aria-valuetext", "30%");
  });

  it("has a default accessible name when none is given", () => {
    render(<ProgressBar value={10} />);
    expect(screen.getByRole("progressbar")).toHaveAccessibleName();
  });

  it("does not set valuetext when indeterminate", () => {
    render(<ProgressBar indeterminate aria-label="Betöltés" />);
    const bar = screen.getByRole("progressbar", { name: "Betöltés" });
    expect(bar).not.toHaveAttribute("aria-valuetext");
  });

  it("is axe-clean with an explicit aria-label", async () => {
    const { container } = render(<ProgressBar value={50} aria-label="X" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ProgressBar", () => {
  it("renders a determinate fill at the given width and exposes aria values", () => {
    render(<ProgressBar value={42} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("42%");
    // Determinate fill must NOT use the slide animation.
    expect(fill.className).not.toContain("woaProgress");
  });

  it("clamps out-of-range values", () => {
    render(<ProgressBar value={250} />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("uses the woaProgress animation (not width) when indeterminate", () => {
    render(<ProgressBar indeterminate />);
    const bar = screen.getByRole("progressbar");
    const inner = bar.firstElementChild as HTMLElement;
    expect(inner.className).toContain("woaProgress");
    // Indeterminate must not set an inline width fill.
    expect(inner.style.width).toBe("");
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });

  it("shows a tabular percentage label when requested", () => {
    render(<ProgressBar value={64} showLabel />);
    expect(screen.getByText("64%")).toBeInTheDocument();
  });
});
