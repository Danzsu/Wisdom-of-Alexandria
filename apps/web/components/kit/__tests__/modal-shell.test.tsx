import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Modal,
  ModalTrigger,
  ModalShell,
  ModalHeader,
  ModalBody,
} from "@/components/kit/modal-shell";
import { hu } from "@/lib/i18n/hu";

function ControlledModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      {/* ModalHeader supplies the Dialog.Title — no `title` prop needed. */}
      <ModalShell>
        <ModalHeader title="Új Codex-bejegyzés" />
        <ModalBody>Tartalom</ModalBody>
      </ModalShell>
    </Modal>
  );
}

describe("ModalShell", () => {
  it("opens from a trigger and exposes an accessible dialog with a title from ModalHeader", async () => {
    render(
      <Modal>
        <ModalTrigger>Megnyitás</ModalTrigger>
        <ModalShell>
          <ModalHeader title="Profil" />
          <ModalBody>Tartalom</ModalBody>
        </ModalShell>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Megnyitás"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Radix associates the Dialog.Title; the accessible name resolves to it.
    expect(dialog).toHaveAccessibleName("Profil");
  });

  it("uses the title prop as a visually-hidden Dialog.Title when no header is used", async () => {
    render(
      <Modal>
        <ModalTrigger>Megnyitás</ModalTrigger>
        <ModalShell title="Csak a11y cím">
          <ModalBody>Tartalom</ModalBody>
        </ModalShell>
      </Modal>,
    );
    await userEvent.click(screen.getByText("Megnyitás"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Csak a11y cím");
  });

  it("falls back to a generic accessible name when neither title nor header is provided", async () => {
    render(
      <Modal>
        <ModalTrigger>Megnyitás</ModalTrigger>
        <ModalShell>
          <ModalBody>Tartalom</ModalBody>
        </ModalShell>
      </Modal>,
    );
    await userEvent.click(screen.getByText("Megnyitás"));
    const dialog = await screen.findByRole("dialog");
    // A dialog must never be nameless: the shell emits a hidden fallback title.
    expect(dialog).toHaveAccessibleName(hu.modal.untitledFallback);
  });

  it("does not double-render a title when a ModalHeader supplies one", async () => {
    render(
      <Modal>
        <ModalTrigger>Megnyitás</ModalTrigger>
        <ModalShell>
          <ModalHeader title="Profil" />
          <ModalBody>Tartalom</ModalBody>
        </ModalShell>
      </Modal>,
    );
    await userEvent.click(screen.getByText("Megnyitás"));
    const dialog = await screen.findByRole("dialog");
    // The header title is the only accessible name (no fallback duplication).
    expect(dialog).toHaveAccessibleName("Profil");
    expect(screen.queryByText(hu.modal.untitledFallback)).not.toBeInTheDocument();
  });

  it("closes via onOpenChange when the close button is clicked", async () => {
    const onOpenChange = vi.fn();
    render(<ControlledModal open onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Bezárás" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes via onOpenChange on Escape", async () => {
    const onOpenChange = vi.fn();
    render(<ControlledModal open onOpenChange={onOpenChange} />);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
