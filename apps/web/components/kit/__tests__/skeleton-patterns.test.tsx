import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import {
  SkeletonCard,
  SkeletonList,
  SkeletonTable,
} from "@/components/kit/skeleton-patterns";

describe("SkeletonList", () => {
  it("renders N rows, all aria-hidden at root", () => {
    render(<SkeletonList rows={4} />);
    const root = screen.getByTestId("skeleton-list");
    expect(root.querySelectorAll(".woa-skel").length).toBeGreaterThanOrEqual(4);
    expect(root).toHaveAttribute("aria-hidden", "true");
  });

  it("renders exactly the requested number of rows", () => {
    render(<SkeletonList rows={2} />);
    const root = screen.getByTestId("skeleton-list");
    expect(root.querySelectorAll(".woa-skel").length).toBe(2);
  });
});

describe("SkeletonTable", () => {
  it("renders rows × cols cells", () => {
    render(<SkeletonTable rows={3} cols={4} />);
    expect(
      screen.getByTestId("skeleton-table").querySelectorAll(".woa-skel").length,
    ).toBe(12);
  });

  it("root is aria-hidden", () => {
    render(<SkeletonTable rows={2} cols={2} />);
    expect(screen.getByTestId("skeleton-table")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("SkeletonCard", () => {
  it("renders with data-testid and is aria-hidden", () => {
    render(<SkeletonCard />);
    const root = screen.getByTestId("skeleton-card");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.querySelectorAll(".woa-skel").length).toBeGreaterThanOrEqual(1);
  });
});

describe("accessibility", () => {
  it("SkeletonList is axe-clean", async () => {
    const { container } = render(<SkeletonList rows={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SkeletonTable is axe-clean", async () => {
    const { container } = render(<SkeletonTable rows={2} cols={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SkeletonCard is axe-clean", async () => {
    const { container } = render(<SkeletonCard />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
