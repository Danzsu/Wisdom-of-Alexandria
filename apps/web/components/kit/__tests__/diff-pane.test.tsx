import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DiffPane,
  DiffDeletion,
  DiffAddition,
  type DiffSegment,
} from "@/components/kit/diff-pane";

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
