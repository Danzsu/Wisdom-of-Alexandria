import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RangeSlider } from "@/components/kit/range-slider";

describe("RangeSlider", () => {
  it("exposes a slider with the configured range and current value", () => {
    render(
      <RangeSlider
        aria-label="Temperature"
        min={0}
        max={2}
        step={0.1}
        value={0.8}
        onValueChange={() => {}}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Temperature" });
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "2");
    expect(slider).toHaveAttribute("aria-valuenow", "0.8");
  });

  it("emits a scalar value via onValueChange on keyboard change", async () => {
    const user = (await import("@testing-library/user-event")).default;
    const onValueChange = vi.fn();
    render(
      <RangeSlider
        aria-label="Temperature"
        min={0}
        max={2}
        step={0.1}
        defaultValue={0.8}
        onValueChange={onValueChange}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Temperature" });
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalled();
    const arg = onValueChange.mock.calls[0][0];
    expect(typeof arg).toBe("number");
    expect(arg).toBeCloseTo(0.9, 5);
  });

  it("renders a tabular value label when showValue is set", () => {
    render(
      <RangeSlider
        aria-label="Temperature"
        min={0}
        max={2}
        step={0.1}
        value={0.8}
        onValueChange={() => {}}
        showValue
      />,
    );
    expect(screen.getByText("0.8")).toBeInTheDocument();
  });
});
