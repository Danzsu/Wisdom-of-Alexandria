import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "@/components/kit/segmented-control";

const OPTIONS = [
  { value: "grid", label: "Rács" },
  { value: "matrix", label: "Mátrix" },
] as const;

describe("SegmentedControl", () => {
  it("marks the active option and styles it with the accent fill", () => {
    render(
      <SegmentedControl
        aria-label="nézet"
        value="grid"
        onValueChange={() => {}}
        options={[...OPTIONS]}
      />,
    );
    const active = screen.getByRole("radio", { name: "Rács" });
    expect(active).toHaveAttribute("aria-checked", "true");
    expect(active.className).toContain("bg-accent-strong");
    expect(active.className).toContain("text-accent-fg");

    const inactive = screen.getByRole("radio", { name: "Mátrix" });
    expect(inactive).toHaveAttribute("aria-checked", "false");
  });

  it("fires onValueChange with the clicked value", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="nézet"
        value="grid"
        onValueChange={onValueChange}
        options={[...OPTIONS]}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Mátrix" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("matrix");
  });
});
