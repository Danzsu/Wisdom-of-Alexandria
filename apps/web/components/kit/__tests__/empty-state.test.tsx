import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { ImageIcon } from "lucide-react";
import { EmptyState } from "@/components/kit/empty-state";

describe("EmptyState", () => {
  it("renders the title as a heading", () => {
    render(<EmptyState title="Nincs még borító" />);
    expect(
      screen.getByRole("heading", { name: "Nincs még borító" }),
    ).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Üres" description="Generálj egyet." />);
    expect(screen.getByText("Generálj egyet.")).toBeInTheDocument();
  });

  it("renders title, description, and a working CTA action object", async () => {
    const onAct = vi.fn();
    render(
      <EmptyState
        icon={<ImageIcon />}
        title="Nincs még borító"
        description="Generálj egyet."
        action={{ label: "Borító generálása", onClick: onAct }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Nincs még borító" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Generálj egyet.")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Borító generálása" }),
    );
    expect(onAct).toHaveBeenCalledOnce();
  });

  it("renders a custom ReactNode action", () => {
    render(
      <EmptyState
        title="Üres"
        action={<button type="button">Egyedi gomb</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Egyedi gomb" }),
    ).toBeInTheDocument();
  });

  it("does not render description or action when not provided", () => {
    render(<EmptyState title="Üres" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("decorative icon is aria-hidden", () => {
    const { container } = render(
      <EmptyState icon={<ImageIcon />} title="Üres" />,
    );
    const badge = container.querySelector("[aria-hidden=true]");
    expect(badge).toBeInTheDocument();
  });
});

describe("EmptyState accessibility", () => {
  it("is axe-clean with title only", async () => {
    const { container } = render(<EmptyState title="Üres" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean with all props", async () => {
    const { container } = render(
      <EmptyState
        icon={<ImageIcon />}
        title="Nincs borító"
        description="Generálj egyet."
        action={{ label: "Generálás", onClick: () => undefined }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
