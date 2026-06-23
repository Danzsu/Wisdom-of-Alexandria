import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { Select } from "@/components/kit/select";

const OPTIONS = [
  { value: "a", label: "Realisztikus" },
  { value: "b", label: "Festett" },
];

describe("Select", () => {
  it("selects an option via the listbox", async () => {
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Stílus"
        value="a"
        onValueChange={onChange}
        options={OPTIONS}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Stílus" });

    // Radix Select under jsdom: open via keyboard (Space/Enter) which is
    // reliably supported in all jsdom environments without needing pointer
    // events. Click first to focus the trigger, then press Space to open.
    trigger.focus();
    await userEvent.keyboard(" ");

    // Wait for the option to appear in the portalled listbox.
    const option = await screen.findByRole("option", { name: "Festett" });
    await userEvent.click(option);

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("reflects the controlled value as selected", () => {
    render(
      <Select
        aria-label="Stílus"
        value="b"
        onValueChange={() => {}}
        options={OPTIONS}
      />,
    );
    // The trigger shows the selected label.
    expect(screen.getByRole("combobox", { name: "Stílus" })).toHaveTextContent(
      "Festett",
    );
  });

  it("shows the placeholder when value is empty", () => {
    render(
      <Select
        aria-label="Stílus"
        value=""
        onValueChange={() => {}}
        options={OPTIONS}
        placeholder="Válassz stílust"
      />,
    );
    expect(screen.getByRole("combobox", { name: "Stílus" })).toHaveTextContent(
      "Válassz stílust",
    );
  });

  it("is disabled when the disabled prop is set", () => {
    render(
      <Select
        aria-label="Stílus"
        value="a"
        onValueChange={() => {}}
        options={OPTIONS}
        disabled
      />,
    );
    expect(screen.getByRole("combobox", { name: "Stílus" })).toBeDisabled();
  });

  it("is axe-clean in closed state", async () => {
    const { container } = render(
      <Select
        aria-label="Stílus"
        value="a"
        onValueChange={() => {}}
        options={OPTIONS}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
