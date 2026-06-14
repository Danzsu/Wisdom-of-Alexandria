import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
  MenuSection,
} from "@/components/kit/popover-menu";

function Menu({
  onArchive,
  onDelete,
}: {
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <PopoverMenu>
      <PopoverMenuTrigger>Műveletek</PopoverMenuTrigger>
      <PopoverMenuContent>
        <MenuSection label="Jelenet" />
        <MenuRow onSelect={onArchive}>Archiválás</MenuRow>
        <MenuRow variant="danger" onSelect={onDelete}>
          Törlés
        </MenuRow>
      </PopoverMenuContent>
    </PopoverMenu>
  );
}

describe("PopoverMenu", () => {
  it("opens on trigger click and reveals the menu rows", async () => {
    render(<Menu onArchive={() => {}} onDelete={() => {}} />);
    expect(screen.queryByText("Archiválás")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Műveletek"));
    expect(await screen.findByText("Archiválás")).toBeInTheDocument();
    expect(screen.getByText("Jelenet")).toBeInTheDocument();
  });

  it("fires the row callback when a MenuRow is clicked", async () => {
    const onArchive = vi.fn();
    render(<Menu onArchive={onArchive} onDelete={() => {}} />);
    await userEvent.click(screen.getByText("Műveletek"));
    await userEvent.click(await screen.findByText("Archiválás"));
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it("applies the danger variant styling to a destructive row", async () => {
    render(<Menu onArchive={() => {}} onDelete={() => {}} />);
    await userEvent.click(screen.getByText("Műveletek"));
    const danger = await screen.findByText("Törlés");
    const row = danger.closest('[role="menuitem"]');
    expect(row?.className).toContain("text-danger-text");
  });
});
