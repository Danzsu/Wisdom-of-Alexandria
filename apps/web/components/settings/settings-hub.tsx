"use client";

import { ChevronRight, Cpu, Cloud, Workflow, Archive, Download } from "lucide-react";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useModels } from "@/lib/api/ai-hooks";
import { useProviders } from "@/lib/api/providers-hooks";
import { GenerationSection } from "./generation-section";
import type { SettingsSubpage } from "./types";

export interface SettingsHubProps {
  onNavigate: (subpage: SettingsSubpage) => void;
}

/**
 * Settings hub: the three provider nav-cards (Local / Cloud / MCP), the
 * Generálás params (client-persisted) and the Adatkezelés stubs. Local shows
 * the real installed-model count from GET /ai/models; Cloud/MCP are static
 * status pills (V1/V2).
 */
export function SettingsHub({ onNavigate }: SettingsHubProps) {
  const modelsQuery = useModels();
  const localCount = modelsQuery.data?.models.filter(
    (m) => m.kind === "local",
  ).length;

  // Real configured cloud-provider count (every non-ollama provider) — drives
  // the Cloud card badge.
  const providersQuery = useProviders();
  const cloudCount =
    providersQuery.data?.filter((p) => p.type !== "ollama").length ?? 0;

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-semibold text-text">
        {hu.settings.title}
      </h1>
      <p className="mb-6 text-[13px] text-text-muted">{hu.settings.subtitle}</p>

      <SectionEyebrow as="h3" className="mb-2.5">
        {hu.settings.providersLabel}
      </SectionEyebrow>
      <div className="mb-7 flex flex-col gap-2.5">
        <ProviderCard
          icon={<Cpu size={20} aria-hidden="true" />}
          iconClass="bg-success-muted text-success-text"
          title={hu.settings.localTitle}
          sub={hu.settings.localHubSub(localCount ?? 0)}
          badge={hu.settings.localBadge}
          badgeClass="bg-success-muted text-success-text"
          badgeDot="bg-success"
          onClick={() => onNavigate("local")}
        />
        <ProviderCard
          icon={<Cloud size={20} aria-hidden="true" />}
          iconClass="bg-ai-muted text-ai-text"
          title={hu.settings.cloudTitle}
          sub={hu.settings.cloudHubSub}
          badge={hu.settings.cloudHubBadge(cloudCount)}
          badgeClass={
            cloudCount > 0
              ? "bg-ai-muted text-ai-text"
              : "bg-surface-muted text-text-muted"
          }
          onClick={() => onNavigate("cloud")}
        />
        <ProviderCard
          icon={<Workflow size={20} aria-hidden="true" />}
          iconClass="bg-accent-muted text-accent-text"
          title={hu.settings.mcpTitle}
          sub={hu.settings.mcpHubSub}
          badge={hu.settings.mcpBadge}
          badgeClass="bg-surface-muted text-text-muted"
          onClick={() => onNavigate("mcp")}
        />
      </div>

      <GenerationSection />

      <SectionEyebrow as="h3" className="mb-2.5 mt-7">
        {hu.settings.dataLabel}
      </SectionEyebrow>
      <div className="flex flex-col gap-2">
        <DataRow
          icon={<Archive size={16} aria-hidden="true" />}
          title={hu.settings.archiveTitle}
          hint={hu.settings.archiveHint}
          onClick={() => toast.info(hu.settings.archiveToast)}
        />
        <DataRow
          icon={<Download size={16} aria-hidden="true" />}
          title={hu.settings.backupTitle}
          hint={hu.settings.backupHint}
          onClick={() => toast.info(hu.settings.backupToast)}
        />
      </div>
    </div>
  );
}

function ProviderCard({
  icon,
  iconClass,
  title,
  sub,
  badge,
  badgeClass,
  badgeDot,
  onClick,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  sub: string;
  badge: string;
  badgeClass: string;
  badgeDot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={hu.settings.providerNavAria(title)}
      onClick={onClick}
      className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-4 text-left shadow-card transition-shadow hover:border-accent hover:shadow-panel"
    >
      <span
        className={`flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] ${iconClass}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-text">
          {title}
        </span>
        <span className="mt-0.5 block text-[12px] text-text-muted">{sub}</span>
      </span>
      <span
        className={`inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold ${badgeClass}`}
      >
        {badgeDot ? (
          <span className={`h-1.5 w-1.5 rounded-full ${badgeDot}`} />
        ) : null}
        {badge}
      </span>
      <ChevronRight size={16} className="text-text-faint" aria-hidden="true" />
    </button>
  );
}

function DataRow({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-left shadow-card transition-shadow hover:border-border-strong hover:shadow-panel"
    >
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-surface-muted text-text-soft">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-text">
          {title}
        </span>
        <span className="mt-px block text-[12px] text-text-muted">{hint}</span>
      </span>
      <ChevronRight size={16} className="text-text-faint" aria-hidden="true" />
    </button>
  );
}
