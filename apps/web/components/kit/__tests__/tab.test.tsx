import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tab, TabBar } from "@/components/kit/tab";

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
});
