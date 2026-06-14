import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tab, TabBar } from "@/components/kit/tab";

/** A controlled TabBar (click + arrow keys drive the same `active` state). */
function ControlledTabs() {
  const [tab, setTab] = useState("a");
  return (
    <TabBar aria-label="tabok">
      {[
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ].map((t) => (
        <Tab key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
          {t.label}
        </Tab>
      ))}
    </TabBar>
  );
}

describe("Tab", () => {
  it("reflects the active state in aria-selected and accent classes", () => {
    render(
      <TabBar aria-label="tabok">
        <Tab active>Részletek</Tab>
        <Tab>Megemlítések</Tab>
      </TabBar>,
    );
    const active = screen.getByRole("tab", { name: "Részletek" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active.className).toContain("border-b-accent");
    expect(active.className).toContain("text-accent-text");

    const inactive = screen.getByRole("tab", { name: "Megemlítések" });
    expect(inactive).toHaveAttribute("aria-selected", "false");
    expect(inactive.className).toContain("text-text-muted");
  });

  it("renders the vertical inspector variant with an icon", () => {
    render(
      <Tab orientation="vertical" icon={<span data-testid="icon" />}>
        AI
      </Tab>,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("tab").className).toContain("flex-col");
  });

  it("TabBar exposes a tablist", () => {
    render(
      <TabBar aria-label="tabok">
        <Tab active>A</Tab>
      </TabBar>,
    );
    expect(screen.getByRole("tablist", { name: "tabok" })).toBeInTheDocument();
  });

  it("uses a roving tabindex (only the active tab is tabbable)", () => {
    render(
      <TabBar aria-label="tabok">
        <Tab active>A</Tab>
        <Tab>B</Tab>
      </TabBar>,
    );
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("ArrowRight moves to and activates the next tab (automatic activation)", async () => {
    render(<ControlledTabs />);
    screen.getByRole("tab", { name: "A" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "B" })).toHaveFocus();
  });

  it("ArrowLeft from the first tab wraps to the last", async () => {
    render(<ControlledTabs />);
    screen.getByRole("tab", { name: "A" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "C" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
