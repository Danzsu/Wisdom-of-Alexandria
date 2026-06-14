"use client";

import { User, LogOut } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
} from "@/components/kit/popover-menu";
import { toast } from "@/components/kit/toast";
import { useUIStore } from "@/lib/stores/ui-store";
import { hu } from "@/lib/i18n/hu";

/**
 * 28px user avatar that opens a dropdown with the signed-in identity, a Profil
 * row and a destructive Kijelentkezés row. Both rows are stubs for M2 and
 * surface a "Hamarosan" toast — auth flows arrive later. Open state is owned by
 * the shared UI store so it obeys the single-open-menu rule.
 */
export function UserMenu() {
  const openMenu = useUIStore((s) => s.openMenu);
  const setMenu = useUIStore((s) => s.setMenu);
  const open = openMenu === "user";

  return (
    <PopoverMenu open={open} onOpenChange={(o) => setMenu(o ? "user" : null)}>
      <PopoverMenuTrigger asChild>
        <button
          type="button"
          aria-label={hu.topbar.userMenuAria}
          className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent-muted text-[11px] font-semibold text-accent-text transition-colors hover:bg-accent hover:text-accent-fg"
        >
          {hu.user.initials}
        </button>
      </PopoverMenuTrigger>
      <PopoverMenuContent align="end" className="min-w-[190px]">
        <div className="mb-[3px] border-b border-border px-[9px] py-[7px]">
          <p className="m-0 text-[13px] font-semibold text-text">
            {hu.user.name}
          </p>
          <p className="m-0 mt-px text-[11px] text-text-muted">
            {hu.user.email}
          </p>
        </div>
        <MenuRow
          leadingIcon={<Icon icon={User} size={14} />}
          onSelect={() => toast(hu.toast.comingSoon)}
        >
          {hu.user.profile}
        </MenuRow>
        <MenuRow
          variant="danger"
          leadingIcon={<Icon icon={LogOut} size={14} />}
          onSelect={() => toast(hu.toast.comingSoon)}
        >
          {hu.user.logout}
        </MenuRow>
      </PopoverMenuContent>
    </PopoverMenu>
  );
}
