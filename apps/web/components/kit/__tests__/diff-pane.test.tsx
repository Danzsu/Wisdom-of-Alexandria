import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DiffPane,
  DiffDeletion,
  DiffAddition,
  type DiffSegment,
} from "@/components/kit/diff-pane";

/** Force framer-motion's reduced-motion preference on via matchMedia. */
function withReducedMotion(fn: () => void) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  try {
    fn();
  } finally {
    window.matchMedia = original;
  }
}

const ORIGINAL: DiffSegment[] = [
  { type: "equal", text: "A könyvtár éjszaka " },
  { type: "deletion", text: "fura" },
  { type: "equal", text: " volt." },
];
const SUGGESTION: DiffSegment[] = [
  { type: "equal", text: "A könyvtár éjszaka " },
  { type: "addition", text: "másképp lélegzett" },
  { type: "equal", text: "." },
];

describe("DiffPane", () => {
  it("renders both pane headers", () => {
    render(<DiffPane original={ORIGINAL} suggestion={SUGGESTION} />);
    expect(screen.getByText("Eredeti")).toBeInTheDocument();
    expect(screen.getByText("AI-javaslat")).toBeInTheDocument();
  });

  it("styles deletion segments with strike-through danger classes", () => {
    render(<DiffPane original={ORIGINAL} suggestion={SUGGESTION} />);
    const deleted = screen.getByText("fura");
    expect(deleted.className).toContain("line-through");
    expect(deleted.className).toContain("bg-danger-muted");
  });

  it("styles addition segments with success classes", () => {
    render(<DiffPane original={ORIGINAL} suggestion={SUGGESTION} />);
    const added = screen.getByText("másképp lélegzett");
    expect(added.className).toContain("bg-success-muted");
    expect(added.className).toContain("text-success-text");
  });

  it("renders every segment under reduced motion (FM short-circuits, no item dropped)", () => {
    withReducedMotion(() => {
      render(<DiffPane original={ORIGINAL} suggestion={SUGGESTION} />);
      // The changed segments still render immediately — the calm-motion reveal
      // never hides or drops content when reduced motion is preferred.
      expect(screen.getByText("fura")).toBeInTheDocument();
      expect(screen.getByText("másképp lélegzett")).toBeInTheDocument();
      // Unchanged runs render flat (not wrapped in a motion span) but are present.
      expect(
        screen.getAllByText(/A könyvtár éjszaka/).length,
      ).toBeGreaterThan(0);
    });
  });
});

describe("DiffDeletion / DiffAddition spans", () => {
  it("render their respective styled spans standalone", () => {
    render(
      <p>
        <DiffDeletion>régi</DiffDeletion>
        <DiffAddition>új</DiffAddition>
      </p>,
    );
    expect(screen.getByText("régi").className).toContain("line-through");
    expect(screen.getByText("új").className).toContain("bg-success-muted");
  });
});
