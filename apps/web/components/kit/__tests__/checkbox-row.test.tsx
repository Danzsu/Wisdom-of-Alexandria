import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CheckboxRow,
  SelectableCheckboxCard,
} from "@/components/kit/checkbox-row";

describe("CheckboxRow", () => {
  it("checks and fires onCheckedChange when the label is clicked", async () => {
    const onCheckedChange = vi.fn();
    render(
      <CheckboxRow label="Codex" onCheckedChange={onCheckedChange} />,
    );
    const box = screen.getByRole("checkbox", { name: "Codex" });
    expect(box).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByText("Codex"));
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(box).toHaveAttribute("aria-checked", "true");
  });

  it("renders optional sub-text", () => {
    render(<CheckboxRow label="Teljes regény" subText="lassabb" />);
    expect(screen.getByText("lassabb")).toBeInTheDocument();
  });
});

describe("SelectableCheckboxCard", () => {
  it("enters the selected card state when toggled (uncontrolled)", async () => {
    const onCheckedChange = vi.fn();
    render(
      <SelectableCheckboxCard
        title="Damianosz"
        subTitle="Karakter · 3 említés"
        onCheckedChange={onCheckedChange}
      />,
    );
    const box = screen.getByRole("checkbox", { name: /Damianosz/ });
    await userEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
    // The wrapping card picks up the selected accent classes.
    const card = screen.getByText("Damianosz").closest("div");
    expect(card?.className).toContain("bg-accent-muted");
  });

  it("reflects a controlled checked prop in the card styling", () => {
    render(<SelectableCheckboxCard title="A rejtett jelek" checked />);
    const card = screen.getByText("A rejtett jelek").closest("div");
    expect(card?.className).toContain("border-accent");
  });
});
