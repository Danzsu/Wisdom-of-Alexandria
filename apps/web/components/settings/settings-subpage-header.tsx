"use client";

import { ChevronLeft } from "lucide-react";
import { hu } from "@/lib/i18n/hu";

export interface SettingsSubpageHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

/** Shared subpage header: a back link to the hub + the title + subtitle. */
export function SettingsSubpageHeader({
  title,
  subtitle,
  onBack,
}: SettingsSubpageHeaderProps) {
  return (
    <div>
      <button
        type="button"
        aria-label={hu.settings.backAria}
        onClick={onBack}
        className="mb-3.5 flex h-7 items-center gap-1.5 rounded-lg pl-1.5 pr-2.5 text-[13px] text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        {hu.settings.back}
      </button>
      <h1 className="mb-1 text-[22px] font-semibold text-text">{title}</h1>
      <p className="mb-[22px] text-[13px] text-text-muted">{subtitle}</p>
    </div>
  );
}
