import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { Accordion } from "@/components/kit/accordion";

const SINGLE_ITEM = [{ id: "a", title: "Részletek", content: <p>Tartalom</p> }];
const MULTI_ITEMS = [
  { id: "a", title: "Első", content: <p>Első tartalom</p> },
  { id: "b", title: "Második", content: <p>Második tartalom</p> },
];

describe("Accordion", () => {
  it("expands and collapses an item", async () => {
    render(<Accordion items={SINGLE_ITEM} />);
    const trigger = screen.getByRole("button", { name: "Részletek" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Tartalom")).toBeVisible();
  });

  it("collapses on second click (single type)", async () => {
    render(<Accordion items={SINGLE_ITEM} type="single" />);
    const trigger = screen.getByRole("button", { name: "Részletek" });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("multiple type allows two items open simultaneously", async () => {
    render(<Accordion items={MULTI_ITEMS} type="multiple" />);
    const [triggerA, triggerB] = [
      screen.getByRole("button", { name: "Első" }),
      screen.getByRole("button", { name: "Második" }),
    ];
    await userEvent.click(triggerA);
    await userEvent.click(triggerB);
    expect(triggerA).toHaveAttribute("aria-expanded", "true");
    expect(triggerB).toHaveAttribute("aria-expanded", "true");
  });

  it("defaultValue opens the specified item on mount", () => {
    render(<Accordion items={SINGLE_ITEM} defaultValue="a" />);
    expect(screen.getByRole("button", { name: "Részletek" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("is axe-clean in closed state", async () => {
    const { container } = render(<Accordion items={MULTI_ITEMS} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean in open state", async () => {
    render(<Accordion items={SINGLE_ITEM} />);
    await userEvent.click(screen.getByRole("button", { name: "Részletek" }));
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
