"use client";

import { Download, List, Plus } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";

export interface PlanActionBarProps {
  /** Adds an act — single-act in M7, so this also just adds a chapter + toast. */
  onAddAct: () => void;
  /** Disable the add-act button while a create is in flight (collision guard). */
  isCreating?: boolean;
}

/**
 * Bottom action bar: Felvonás hozzáadása · Létrehozás vázlatból [stub] ·
 * Importálás [stub]. Multi-act planning and the outline/import flows land in M9;
 * the two stubs surface an honest toast rather than a silent no-op.
 */
export function PlanActionBar({ onAddAct, isCreating }: PlanActionBarProps) {
  return (
    <div className="flex h-11 flex-none items-center gap-2 border-t border-border bg-surface px-5">
      <ActionButton
        icon={Plus}
        label={hu.plan.addAct}
        onClick={onAddAct}
        disabled={isCreating}
      />
      <ActionButton
        icon={List}
        label={hu.plan.createFromOutline}
        onClick={() => toast.info(hu.plan.toastCreateFromOutline)}
      />
      <ActionButton
        icon={Download}
        label={hu.plan.importManuscript}
        onClick={() => toast.info(hu.plan.toastImport)}
      />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 items-center gap-[5px] rounded-lg border border-border bg-surface px-[11px] text-[12px] text-text-soft hover:bg-surface-muted disabled:opacity-50"
    >
      <Icon icon={icon} size={12} />
      {label}
    </button>
  );
}
