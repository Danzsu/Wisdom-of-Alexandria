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

/** Walk the DOM and assert every role="tab" element has a role="tablist" ancestor. */
function assertTabsHaveTablistAncestor(container: HTMLElement): void {
    const tabs = container.querySelectorAll('[role="tab"]');
    for (const tab of tabs) {
      let ancestor: Element | null = tab.parentElement;
      let found = false;
      while (ancestor) {
        if (ancestor.getAttribute("role") === "tablist") {
          found = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      expect(
        found,
        `role="tab" element ("${tab.textContent?.trim()}") has no role="tablist" ancestor`,
      ).toBe(true);
    }
}

describe("Tab — tablist parent requirement (T4)", () => {
  it("bare Tab elements outside a TabBar violate the tablist requirement", () => {
    // Confirm the structural rule: a role="tab" MUST have a role="tablist" ancestor.
    // This test documents the broken pattern — the fix is to wrap in a TabBar.
    const { container } = render(
      <div>
        <Tab active>AI</Tab>
        <Tab>Codex</Tab>
      </div>,
    );
    const tabs = container.querySelectorAll('[role="tab"]');
    const hasMissingParent = Array.from(tabs).some((tab) => {
      let ancestor: Element | null = tab.parentElement;
      while (ancestor) {
        if (ancestor.getAttribute("role") === "tablist") return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });
    expect(hasMissingParent).toBe(true);
  });

  it("all role=tab elements have a role=tablist ancestor when wrapped in TabBar", () => {
    const { container } = render(
      <TabBar aria-label="Inspektor">
        <Tab active>AI</Tab>
        <Tab>Codex</Tab>
        <Tab>Jegyzet</Tab>
      </TabBar>,
    );
    assertTabsHaveTablistAncestor(container);
  });
});
