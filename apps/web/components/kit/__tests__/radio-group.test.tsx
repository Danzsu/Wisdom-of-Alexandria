import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TypedRadioGroup } from "@/components/kit/radio-group";

const OPTIONS = [
  { value: "scene", label: "Jelenet kontextus" },
  { value: "book", label: "Teljes regény" },
] as const;

describe("RadioGroup", () => {
  it("selects an option and fires onValueChange with the value", async () => {
    const onValueChange = vi.fn();
    render(
      <TypedRadioGroup
        aria-label="hatókör"
        options={[...OPTIONS]}
        onValueChange={onValueChange}
      />,
    );
    const book = screen.getByRole("radio", { name: "Teljes regény" });
    await userEvent.click(book);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("book");
    expect(book).toHaveAttribute("aria-checked", "true");
  });

  it("reflects a controlled value as the checked radio", () => {
    render(
      <TypedRadioGroup
        aria-label="hatókör"
        options={[...OPTIONS]}
        value="scene"
        onValueChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "Jelenet kontextus" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Teljes regény" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
