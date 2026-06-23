"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { StatusDot } from "./status-dot";
import { Badge } from "./badge";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
  MenuSection,
} from "./popover-menu";

/** A single selectable model. Data only — names never hardcoded in the component. */
export interface ModelOption {
  /** Stable id (e.g. "ollama/llama3.2"). */
  id: string;
  /** Display label. */
  label: string;
  /** `local` → success dot, `cloud` → ai dot. */
  kind: "local" | "cloud";
  /** Show a "Moderált" warning badge (moderated cloud models). */
  moderated?: boolean;
}

/** Grouped model list (sections rendered in order). */
export interface ModelGroup {
  /** Section heading (e.g. "Lokális" / "Felhő"). */
  label: string;
  models: ModelOption[];
}

export interface ModelSelectorProps {
  /** Grouped models (data, not hardcoded). */
  groups: ModelGroup[];
  /** Currently-selected model id. */
  value: string;
  /** Fired with the newly-selected model id. */
  onChange: (id: string) => void;
  /** Moderated-badge text. */
  moderatedLabel?: string;
  /** Trigger class override. */
  className?: string;
  /** Menu content class override. */
  contentClassName?: string;
}

/** Find the selected option across all groups (for the trigger label/dot). */
function findSelected(
  groups: ModelGroup[],
  value: string,
): ModelOption | undefined {
  for (const group of groups) {
    const hit = group.models.find((m) => m.id === value);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Model picker. The 36px trigger shows a leading StatusDot (success=local /
 * ai=cloud), the selected label and a chevron; opening reveals a sectioned menu
 * (e.g. Lokális / Felhő) with a per-model dot and a "Moderált" warning badge on
 * moderated models. Models arrive as `groups` data — never hardcoded here.
 */
export function ModelSelector({
  groups,
  value,
  onChange,
  moderatedLabel = "Moderált",
  className,
  contentClassName,
}: ModelSelectorProps) {
  const selected = findSelected(groups, value);

  return (
    <PopoverMenu>
      <PopoverMenuTrigger
        className={cn(
          "inline-flex h-9 w-full cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-surface px-3 font-sans text-body text-text-soft transition-colors",
          "hover:border-border-strong",
          "data-[state=open]:border-accent",
          className,
        )}
      >
        <StatusDot
          variant={selected?.kind === "cloud" ? "ai" : "success"}
          size={7}
        />
        <span className="flex-1 truncate text-left">
          {selected?.label ?? value}
        </span>
        <Icon icon={ChevronDown} size={12} />
      </PopoverMenuTrigger>
      <PopoverMenuContent
        align="start"
        className={cn("min-w-[var(--radix-dropdown-menu-trigger-width)]", contentClassName)}
      >
        {groups.map((group) => (
          <div key={group.label} className="contents">
            <MenuSection label={group.label} />
            {group.models.map((model) => (
              <MenuRow
                key={model.id}
                leadingIcon={
                  <StatusDot
                    variant={model.kind === "cloud" ? "ai" : "success"}
                    size={6}
                  />
                }
                trailing={
                  model.moderated ? (
                    <Badge variant="warning" size={16}>
                      {moderatedLabel}
                    </Badge>
                  ) : undefined
                }
                onSelect={() => onChange(model.id)}
              >
                {model.label}
              </MenuRow>
            ))}
          </div>
        ))}
      </PopoverMenuContent>
    </PopoverMenu>
  );
}
