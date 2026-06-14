import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/kit/alert-dialog";

describe("ConfirmDialog", () => {
  it("renders an alertdialog with title and description when open", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Végleges törlés?"
        description="Ez a művelet nem vonható vissza."
        onConfirm={() => {}}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Végleges törlés?");
    expect(screen.getByText("Ez a művelet nem vonható vissza.")).toBeInTheDocument();
  });

  it("fires onConfirm when the destructive action is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Végleges törlés?"
        description="…"
        confirmLabel="Végleges törlés"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Végleges törlés" }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not fire onConfirm when cancelled, and fires onCancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Végleges törlés?"
        description="…"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Mégse" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
