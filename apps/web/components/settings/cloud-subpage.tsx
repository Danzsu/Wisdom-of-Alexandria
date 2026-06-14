"use client";

import { PasswordInput } from "@/components/kit/password-input";
import { Button } from "@/components/kit/button";
import { Info } from "lucide-react";
import { hu } from "@/lib/i18n/hu";
import { SettingsSubpageHeader } from "./settings-subpage-header";

export interface CloudSubpageProps {
  onBack: () => void;
}

/**
 * Cloud provider subpage — a V1 VISUAL STUB. The API-key rows are static
 * (Gemini shown "connected", Claude/OpenRouter as password inputs) and no key
 * is actually stored in the MVP; an honest note states this. The inputs are
 * uncontrolled visuals only (no submit wiring).
 */
export function CloudSubpage({ onBack }: CloudSubpageProps) {
  return (
    <div>
      <SettingsSubpageHeader
        title={hu.settings.cloudTitle}
        subtitle={hu.settings.cloudSubtitle}
        onBack={onBack}
      />

      <div className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-border border-l-[3px] border-l-ai bg-surface px-3.5 py-3">
        <Info size={15} className="mt-px flex-none text-ai" aria-hidden="true" />
        <p className="text-[12px] leading-relaxed text-text-soft">
          {hu.settings.cloudV1Note}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Gemini — shown as connected (visual). */}
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-card">
          <span className="h-2 w-2 flex-none rounded-full bg-success" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-text">
              {hu.settings.cloudGeminiName}
            </p>
            <p className="mt-0.5 text-[12px] text-success-text">
              {hu.settings.cloudGeminiStatus}
            </p>
          </div>
          <Button variant="secondary" size={28} disabled>
            {hu.settings.cloudGeminiSwap}
          </Button>
        </div>

        {/* Claude — not set (visual password input). */}
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-card">
          <span className="h-2 w-2 flex-none rounded-full bg-text-faint" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-text">
              {hu.settings.cloudClaudeName}
            </p>
            <p className="mt-0.5 text-[12px] text-text-muted">
              {hu.settings.cloudNotSet}
            </p>
          </div>
          <PasswordInput
            aria-label={hu.settings.cloudClaudeName}
            placeholder={hu.settings.cloudClaudePlaceholder}
            wrapperClassName="w-[160px]"
            disabled
          />
        </div>

        {/* OpenRouter — not set (visual password input). */}
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-card">
          <span className="h-2 w-2 flex-none rounded-full bg-text-faint" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-text">
              {hu.settings.cloudOpenRouterName}
            </p>
            <p className="mt-0.5 text-[12px] text-text-muted">
              {hu.settings.cloudNotSet}
            </p>
          </div>
          <PasswordInput
            aria-label={hu.settings.cloudOpenRouterName}
            placeholder={hu.settings.cloudOpenRouterPlaceholder}
            wrapperClassName="w-[160px]"
            disabled
          />
        </div>
      </div>
    </div>
  );
}
