"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
  MenuSection,
} from "./popover-menu";

export interface SplitMenuItem {
  /** Stable id passed to `onSelect`. */
  id: string;
  /** Row title. */
  label: ReactNode;
  /** Optional muted subtitle (renders a two-line rich row). */
  subtitle?: ReactNode;
  /** Leading accent icon. */
  icon?: ReactNode;
  /** Section heading shown above this item (groups consecutive items). */
  section?: string;
  /** `danger` styles the row as destructive. */
  variant?: "default" | "danger";
  disabled?: boolean;
}

export interface SplitButtonDropdownProps {
  /** Trigger label. */
  label: ReactNode;
  /** Leading icon on the trigger. */
  leadingIcon?: ReactNode;
  /** Menu items. */
  items: SplitMenuItem[];
  /** Fired with the selected item id. */
  onSelect?: (id: string) => void;
  /** Content alignment relative to the trigger. */
  align?: "start" | "center" | "end";
  /** Min-width of the menu content. */
  contentClassName?: string;
  /** Trigger class override. */
  className?: string;
}

/**
 * A pill-style trigger (label + optional leading icon + trailing chevron) wired
 * to a `PopoverMenu`. Items may carry a `subtitle` for rich two-line rows and a
 * `section` heading to group consecutive items. Used for the Írás / Több /
 * Formátum / model split buttons.
 */
export function SplitButtonDropdown({
  label,
  leadingIcon,
  items,
  onSelect,
  align = "start",
  contentClassName,
  className,
}: SplitButtonDropdownProps) {
  // Group items under their (optional) section so a heading renders once per run.
  let lastSection: string | undefined;

  return (
    <PopoverMenu>
      <PopoverMenuTrigger
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-transparent px-[14px] font-sans text-body text-text-soft transition-colors",
          "hover:border-accent hover:bg-accent-muted hover:text-accent-text",
          "data-[state=open]:border-accent data-[state=open]:bg-accent-muted data-[state=open]:text-accent-text",
          className,
        )}
      >
        {leadingIcon}
        <span>{label}</span>
        <Icon icon={ChevronDown} size={14} />
      </PopoverMenuTrigger>
      <PopoverMenuContent align={align} className={cn("min-w-[200px]", contentClassName)}>
        {items.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          lastSection = item.section;
          return (
            <div key={item.id} className="contents">
              {showSection ? <MenuSection label={item.section} /> : null}
              <MenuRow
                variant={item.variant}
                leadingIcon={item.icon}
                disabled={item.disabled}
                onSelect={() => onSelect?.(item.id)}
              >
                {item.subtitle ? (
                  <span className="flex flex-col">
                    <span className="text-body">{item.label}</span>
                    <span className="text-tiny text-text-muted">
                      {item.subtitle}
                    </span>
                  </span>
                ) : (
                  item.label
                )}
              </MenuRow>
            </div>
          );
        })}
      </PopoverMenuContent>
    </PopoverMenu>
  );
}
