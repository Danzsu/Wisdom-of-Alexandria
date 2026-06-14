import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToggleSwitch } from "@/components/kit/toggle-switch";

describe("ToggleSwitch", () => {
  it("fires onCheckedChange and flips aria-checked when toggled", async () => {
    const onCheckedChange = vi.fn();
    render(
      <ToggleSwitch aria-label="téma" onCheckedChange={onCheckedChange} />,
    );
    const sw = screen.getByRole("switch", { name: "téma" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("associates a visible label with the switch", async () => {
    const onCheckedChange = vi.fn();
    render(
      <ToggleSwitch label="Automatikus mentés" onCheckedChange={onCheckedChange} />,
    );
    await userEvent.click(screen.getByText("Automatikus mentés"));
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("renders the smaller sm track size", () => {
    render(<ToggleSwitch aria-label="kicsi" size="sm" />);
    expect(screen.getByRole("switch", { name: "kicsi" }).className).toContain(
      "w-9",
    );
  });
});
