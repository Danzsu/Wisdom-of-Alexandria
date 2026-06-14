import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "@/components/kit/icon-button";

describe("IconButton", () => {
  it("exposes the required aria-label and the data-press hook", () => {
    render(
      <IconButton aria-label="hozzáadás">
        <span />
      </IconButton>,
    );
    const btn = screen.getByRole("button", { name: "hozzáadás" });
    expect(btn).toHaveAttribute("data-press", "");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("applies variant hover classes", () => {
    render(
      <IconButton aria-label="törlés" variant="danger">
        <span />
      </IconButton>,
    );
    expect(screen.getByRole("button").className).toContain("hover:bg-danger-muted");
  });

  it("fires click handlers", async () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="kattints" onClick={onClick}>
        <span />
      </IconButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "kattints" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
