"use client";

import { Search, FileText, Plus, Info } from "lucide-react";
import { Button } from "@/components/kit/button";
import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { SettingsSubpageHeader } from "./settings-subpage-header";

export interface McpSubpageProps {
  onBack: () => void;
}

/**
 * MCP provider subpage — a V2 VISUAL STUB. Two demo server rows with running
 * pills + (disabled) toggles, an honest V2 note, and the "MCP szerver
 * hozzáadása" button → "(V2-ben érkezik)" toast. No real MCP wiring.
 */
export function McpSubpage({ onBack }: McpSubpageProps) {
  return (
    <div>
      <SettingsSubpageHeader
        title={hu.settings.mcpTitle}
        subtitle={hu.settings.mcpSubtitle}
        onBack={onBack}
      />

      <div className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-border border-l-[3px] border-l-ai bg-surface px-3.5 py-3">
        <Info size={15} className="mt-px flex-none text-ai" aria-hidden="true" />
        <p className="text-[12px] leading-relaxed text-text-soft">
          {hu.settings.mcpV2Note}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-2.5">
        <McpRow
          icon={<Search size={16} aria-hidden="true" />}
          iconClass="bg-success-muted text-success-text"
          name={hu.settings.mcpSearchName}
          sub={hu.settings.mcpSearchSub}
        />
        <McpRow
          icon={<FileText size={16} aria-hidden="true" />}
          iconClass="bg-ai-muted text-ai-text"
          name={hu.settings.mcpResearchName}
          sub={hu.settings.mcpResearchSub}
        />
      </div>

      <Button
        variant="dashed"
        size={34}
        className="font-semibold text-accent-text"
        onClick={() => toast.info(hu.toast.comingSoon)}
      >
        <Plus size={13} aria-hidden="true" />
        {hu.settings.mcpAddServer}
      </Button>
      <p className="mt-3.5 text-[11px] text-text-muted">
        {hu.settings.mcpFootnote}
      </p>
    </div>
  );
}

function McpRow({
  icon,
  iconClass,
  name,
  sub,
}: {
  icon: React.ReactNode;
  iconClass: string;
  name: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-card">
      <span
        className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] ${iconClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-text">{name}</p>
        <p className="mt-0.5 text-[12px] text-text-muted">{sub}</p>
      </div>
      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-success-muted px-2.5 text-[11px] font-semibold text-success-text">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        {hu.settings.mcpRunning}
      </span>
      <ToggleSwitch
        aria-label={hu.settings.mcpToggleAria(name)}
        size="sm"
        defaultChecked
        disabled
      />
    </div>
  );
}
