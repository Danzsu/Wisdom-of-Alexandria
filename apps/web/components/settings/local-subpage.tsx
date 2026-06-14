"use client";

import { Circle, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/kit/button";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useModels } from "@/lib/api/ai-hooks";
import { SettingsSubpageHeader } from "./settings-subpage-header";

export interface LocalSubpageProps {
  onBack: () => void;
}

/**
 * Local (Ollama) provider subpage (MVP, real-ish). The installed-models list is
 * REAL — it comes from GET /ai/models (config-driven; never hardcoded). The
 * Ollama health indicator is an honest stub: the backend has no health/ping
 * endpoint, so we show "elérhetőség ismeretlen" and the Ellenőrzés button +
 * Modell letöltése surface "(V1-ben érkezik)" toasts. LM Studio is a V1 visual.
 */
export function LocalSubpage({ onBack }: LocalSubpageProps) {
  const modelsQuery = useModels();
  const defaultModel = modelsQuery.data?.default;
  const localModels =
    modelsQuery.data?.models.filter((m) => m.kind === "local") ?? [];

  return (
    <div>
      <SettingsSubpageHeader
        title={hu.settings.localTitle}
        subtitle={hu.settings.localSubtitle}
        onBack={onBack}
      />

      {/* Ollama row — health is a stub (no backend ping). */}
      <div className="mb-3.5 flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-card">
        <span className="h-2 w-2 rounded-full bg-text-faint" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-text">
            {hu.settings.ollamaName}
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {hu.settings.ollamaEndpoint} · {hu.settings.healthUnknown}
          </p>
        </div>
        <Button
          variant="secondary"
          size={28}
          onClick={() => toast.info(hu.settings.healthToast)}
        >
          {hu.settings.healthCheck}
        </Button>
      </div>

      {/* LM Studio row — V1 visual (not available). */}
      <div className="mb-3.5 flex items-center gap-2.5 rounded-xl border border-danger bg-danger-muted px-3.5 py-3">
        <span className="h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-text">
            {hu.settings.lmStudioName}
          </p>
          <p className="mt-0.5 text-[12px] text-danger-text">
            {hu.settings.lmStudioEndpoint}
          </p>
        </div>
        <Button
          variant="secondary"
          size={28}
          className="border-danger text-danger-text"
          onClick={() => toast.info(hu.settings.lmStudioToast)}
        >
          <RotateCw size={12} aria-hidden="true" />
          {hu.settings.lmStudioReconnect}
        </Button>
      </div>

      <SectionEyebrow as="h3" className="mb-2">
        {hu.settings.installedModelsLabel}
      </SectionEyebrow>

      {modelsQuery.isLoading ? (
        <div className="flex items-center gap-2 py-3 text-[13px] text-text-muted">
          <Spinner size={15} />
          {hu.settings.modelsLoading}
        </div>
      ) : modelsQuery.isError ? (
        <div className="py-3 text-[13px] text-danger-text" role="alert">
          {hu.settings.modelsError}
          {modelsQuery.error ? (
            <span className="mt-1 block text-[12px] text-text-muted">
              {modelsQuery.error.message}
            </span>
          ) : null}
        </div>
      ) : localModels.length === 0 ? (
        <p className="py-3 text-[13px] text-text-muted">
          {hu.settings.modelsEmpty}
        </p>
      ) : (
        <div className="mb-[18px] flex flex-col gap-1.5">
          {localModels.map((model) => (
            <div
              key={model.id}
              className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-2.5"
            >
              <Circle
                size={14}
                className="flex-none text-accent"
                aria-hidden="true"
              />
              <span className="flex-1 text-[13px] text-text">
                {model.label}
              </span>
              {model.id === defaultModel ? (
                <span className="text-[11px] text-text-muted">
                  {hu.settings.modelRecommended}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Button
        variant="dashed"
        size={34}
        className="font-semibold text-accent-text"
        onClick={() => toast.info(hu.settings.downloadModelToast)}
      >
        <Plus size={13} aria-hidden="true" />
        {hu.settings.downloadModel}
      </Button>
    </div>
  );
}
