import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Avatar } from "@/components/kit/avatar";
import { povHash, povSlot, POV_COUNT } from "@/lib/pov-color";

describe("pov-color hash", () => {
  it("is deterministic: same name → same index", () => {
    expect(povHash("Kovács Anna")).toBe(povHash("Kovács Anna"));
    expect(povSlot("Béla")).toBe(povSlot("Béla"));
  });

  it("always lands in the 1..POV_COUNT slot range", () => {
    for (const name of ["a", "Anna", "Zoltán", "X Y Z", "", "🙂"]) {
      const slot = povSlot(name);
      expect(slot).toBeGreaterThanOrEqual(1);
      expect(slot).toBeLessThanOrEqual(POV_COUNT);
    }
  });

  it("distinguishes at least some different names", () => {
    const slots = new Set(
      ["Anna", "Béla", "Cecília", "Dávid", "Emil", "Fanni"].map(povSlot),
    );
    expect(slots.size).toBeGreaterThan(1);
  });
});

describe("Avatar", () => {
  it("derives stable POV colour classes from the name", () => {
    const { container: a } = render(<Avatar name="Kovács Anna" />);
    const { container: b } = render(<Avatar name="Kovács Anna" />);
    const classesA = a.querySelector("span")?.className ?? "";
    const classesB = b.querySelector("span")?.className ?? "";
    const slot = povSlot("Kovács Anna");
    expect(classesA).toContain(`bg-pov${slot}-bg`);
    expect(classesA).toBe(classesB);
  });

  it("derives initials from a full name", () => {
    const { container } = render(<Avatar name="Kovács Anna" />);
    expect(container.textContent).toContain("KA");
  });

  it("honours an explicit colour override", () => {
    const { container } = render(<Avatar initials="AI" color="ai" />);
    expect(container.querySelector("span")?.className).toContain("bg-ai-muted");
  });

  it("renders a presence dot when requested", () => {
    const { container } = render(
      <Avatar name="Online" presence="success" />,
    );
    // Outer avatar + inner presence span.
    expect(container.querySelectorAll("span").length).toBeGreaterThanOrEqual(2);
  });
});
