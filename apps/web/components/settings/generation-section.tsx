"use client";

import { useState } from "react";
import { FormInput } from "@/components/kit/form-input";
import { RangeSlider } from "@/components/kit/range-slider";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { hu } from "@/lib/i18n/hu";
import {
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  TEMPERATURE_STEP,
  useGenerationSettings,
} from "@/lib/stores/generation-settings-store";

/**
 * Generation parameters section (Beállítások hub). Temperature slider (0–2) +
 * Max tokenek input. Both are persisted client-side (Zustand + localStorage)
 * and read by every AI generation call — see the generation-settings store.
 */
export function GenerationSection() {
  const temperature = useGenerationSettings((s) => s.temperature);
  const maxTokens = useGenerationSettings((s) => s.maxTokens);
  const setTemperature = useGenerationSettings((s) => s.setTemperature);
  const setMaxTokens = useGenerationSettings((s) => s.setMaxTokens);

  // Local draft for the max-tokens text field so the user can type freely; the
  // store is only updated with a valid number (the store clamps it).
  const [tokensDraft, setTokensDraft] = useState(String(maxTokens));

  function commitTokens(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      setMaxTokens(parsed);
      // Reflect the (possibly clamped) stored value back into the field.
      setTokensDraft(String(useGenerationSettings.getState().maxTokens));
    } else {
      // Reject a non-numeric value: restore the current stored value.
      setTokensDraft(String(maxTokens));
    }
  }

  return (
    <section>
      <SectionEyebrow as="h3" className="mb-2">
        {hu.settings.generationLabel}
      </SectionEyebrow>
      <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4 shadow-card">
        <label className="flex items-center gap-3 text-[13px] text-text">
          <span className="w-[110px] flex-none">
            {hu.settings.temperatureLabel}
          </span>
          <RangeSlider
            aria-label={hu.settings.temperatureAria}
            min={TEMPERATURE_MIN}
            max={TEMPERATURE_MAX}
            step={TEMPERATURE_STEP}
            value={temperature}
            onValueChange={setTemperature}
            showValue
            formatValue={(v) => v.toFixed(1)}
          />
        </label>
        <label className="flex items-center gap-3 text-[13px] text-text">
          <span className="w-[110px] flex-none">
            {hu.settings.maxTokensLabel}
          </span>
          <FormInput
            aria-label={hu.settings.maxTokensAria}
            inputMode="numeric"
            wrapperClassName="w-[90px]"
            className="h-[30px] tabular-nums"
            value={tokensDraft}
            onChange={(e) => setTokensDraft(e.target.value)}
            onBlur={(e) => commitTokens(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTokens(e.currentTarget.value);
            }}
          />
        </label>
      </div>
      <p className="mt-2.5 text-[11px] text-text-muted">
        {hu.settings.modelRouterNote}
      </p>
    </section>
  );
}
