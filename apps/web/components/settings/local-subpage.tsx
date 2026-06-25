"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, Download, RotateCw } from "lucide-react";
import { Button } from "@/components/kit/button";
import { FieldLabel, FormInput } from "@/components/kit/form-input";
import { ProgressBar } from "@/components/kit/progress-bar";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useModels } from "@/lib/api/ai-hooks";
import { usePullModel, useProviders } from "@/lib/api/providers-hooks";
import { SettingsSubpageHeader } from "./settings-subpage-header";

export interface LocalSubpageProps {
  onBack: () => void;
}

/**
 * Local (Ollama) provider subpage (MVP, real-ish). The installed-models list is
 * REAL — it comes from GET /ai/models (config-driven; never hardcoded). The
 * Ollama health indicator is an honest stub (no backend ping endpoint).
 *
 * Model download (pull) IS real: it streams NDJSON progress from
 * POST /providers/{id}/models/pull on the resolved Ollama provider, renders a
 * live progress bar, then refetches the installed-models list on success. With
 * no Ollama provider configured the download button is disabled with a hint.
 */
export function LocalSubpage({ onBack }: LocalSubpageProps) {
  const modelsQuery = useModels();
  const defaultModel = modelsQuery.data?.default;
  const localModels =
    modelsQuery.data?.models.filter((m) => m.kind === "local") ?? [];

  // Resolve the Ollama provider to pull onto (first configured one).
  const providersQuery = useProviders();
  const ollamaProvider = providersQuery.data?.find((p) => p.type === "ollama");

  const [modelName, setModelName] = useState("");
  const pull = usePullModel(ollamaProvider?.id);

  // Toast on terminal states (success → confirm + clear; error → surface).
  const lastModel = useRef("");
  useEffect(() => {
    if (pull.isSuccess) {
      toast.success(hu.settings.modelPull.success(lastModel.current));
      setModelName("");
    }
  }, [pull.isSuccess]);
  useEffect(() => {
    if (pull.error) {
      toast.error(pull.error.message || hu.settings.modelPull.error);
    }
  }, [pull.error]);

  const startPull = () => {
    const trimmed = modelName.trim();
    if (!trimmed) {
      toast.info(hu.settings.modelPull.emptyName);
      return;
    }
    if (!ollamaProvider) {
      toast.info(hu.settings.modelPull.noProvider);
      return;
    }
    lastModel.current = trimmed;
    pull.start(trimmed);
  };

  const fractionPct =
    pull.fraction != null ? Math.round(pull.fraction * 100) : null;
  const statusText = pull.progress?.status ?? hu.settings.modelPull.pulling;

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

      {/* Modell letöltése — real streaming Ollama pull. */}
      <div className="mt-4 rounded-xl border border-border bg-surface px-3.5 py-3.5 shadow-card">
        <SectionEyebrow as="h3" className="mb-1.5">
          {hu.settings.modelPull.title}
        </SectionEyebrow>
        <p className="mb-3 text-[12px] text-text-muted">
          {hu.settings.modelPull.hint}
        </p>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startPull();
          }}
        >
          <div className="flex-1">
            <FieldLabel htmlFor="model-pull-name">
              {hu.settings.modelPull.label}
            </FieldLabel>
            <FormInput
              id="model-pull-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={hu.settings.modelPull.placeholder}
              disabled={pull.isPulling}
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="cta"
            size={34}
            disabled={pull.isPulling || !modelName.trim()}
          >
            {pull.isPulling ? (
              <Spinner size={14} />
            ) : (
              <Download size={13} aria-hidden="true" />
            )}
            {pull.isPulling
              ? hu.settings.modelPull.pulling
              : hu.settings.modelPull.button}
          </Button>
        </form>

        {pull.isPulling ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[12px] text-text-muted">
              <span>{statusText}</span>
              {fractionPct != null ? (
                <span className="tabular-nums">{fractionPct}%</span>
              ) : null}
            </div>
            {fractionPct != null ? (
              <ProgressBar
                value={fractionPct}
                aria-label={hu.settings.modelPull.progressLabel}
              />
            ) : (
              <ProgressBar
                indeterminate
                aria-label={hu.settings.modelPull.progressLabel}
              />
            )}
          </div>
        ) : null}

        {!ollamaProvider && !providersQuery.isLoading ? (
          <p className="mt-2 text-[12px] text-text-muted" role="note">
            {hu.settings.modelPull.noProvider}
          </p>
        ) : null}
      </div>
    </div>
  );
}
