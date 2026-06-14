"use client";

/**
 * Shared Codex presentation helpers: the lucide icon per entry type, and the
 * 30px round leading visual for a list row / detail header — a POV-coloured
 * initials Avatar for characters (via the deterministic pov hash), or a
 * type-icon chip for everything else. Centralised so the sidebar, detail header
 * and New-Codex picker stay visually consistent.
 */
import {
  Box,
  Building2,
  CheckSquare,
  FileText,
  MapPin,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/kit/avatar";
import { Icon } from "@/components/kit/icon";
import { cn } from "@/lib/utils";
import type { CodexEntryType } from "@/lib/api/codex";

/** The lucide icon used for each entry type (matches the prototype glyphs). */
export const ENTRY_TYPE_ICON: Record<string, LucideIcon> = {
  character: UserRound,
  location: MapPin,
  object: Box,
  organization: Building2,
  lore: FileText,
  rule: CheckSquare,
  custom: FileText,
};

/** Resolve the icon for any entry-type string (falls back to a document icon). */
export function entryTypeIcon(entryType: string): LucideIcon {
  return ENTRY_TYPE_ICON[entryType] ?? FileText;
}

export interface CodexEntryAvatarProps {
  /** The entry type (drives icon vs initials). */
  entryType: string;
  /** The entry name (drives POV colour + initials for characters). */
  name: string;
  /** Diameter in px (30 in the sidebar/header, larger on cards). */
  size?: 30 | 34;
  className?: string;
}

/**
 * Leading visual for a codex entry. Characters get a POV-coloured initials
 * Avatar (so a person is always the same hue); other types get a neutral
 * type-icon chip.
 */
export function CodexEntryAvatar({
  entryType,
  name,
  size = 30,
  className,
}: CodexEntryAvatarProps) {
  if (entryType === "character") {
    return <Avatar name={name} size={size} className={className} />;
  }
  const dimension = size === 34 ? "h-[34px] w-[34px]" : "h-[30px] w-[30px]";
  return (
    <span
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-surface-muted text-text-muted",
        dimension,
        className,
      )}
    >
      <Icon icon={entryTypeIcon(entryType)} size={14} />
    </span>
  );
}

/** Entry-type slugs in the order they should appear as sidebar groups. */
export const ENTRY_TYPE_ORDER: readonly string[] = [
  "character",
  "location",
  "object",
  "organization",
  "lore",
  "rule",
  "custom",
];

/** Stable ordinal for grouping/sorting an arbitrary entry-type string. */
export function entryTypeOrder(entryType: string): number {
  const index = ENTRY_TYPE_ORDER.indexOf(entryType);
  return index === -1 ? ENTRY_TYPE_ORDER.length : index;
}

export type { CodexEntryType };
