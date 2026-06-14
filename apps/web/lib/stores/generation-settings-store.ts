import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Client-persisted AI generation parameters (M8 Beállítások → Generálás).
 *
 * WHY CLIENT-PERSISTED: the backend has NO settings/config endpoint for
 * generation params. The `ModelRouter.generate()` service does take
 * `temperature` / `max_tokens`, but the v1 AI request schemas
 * (`apps/api/app/api/v1/ai.py` — RewriteRequest etc.) do NOT yet surface them
 * (the service hardcodes per-action values). So for the MVP these live on the
 * client (Zustand + localStorage) and are sent as OPTIONAL fields on the AI
 * mutation bodies — FastAPI/Pydantic ignore unknown body fields by default, so
 * this is forward-compatible and harmless: the day the backend schemas add the
 * fields, the values already flow through. See `lib/api/ai.ts` for the wiring.
 *
 * Defaults mirror the prototype exactly (Alexandria App.dc.html ~line 1589):
 *   temperature 0.8 (range 0–2, step 0.1), maxTokens 2048.
 */

/** Inclusive temperature bounds + step (prototype slider). */
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;
export const TEMPERATURE_STEP = 0.1;
export const DEFAULT_TEMPERATURE = 0.8;

/** Max-tokens bounds (sane clamp for the free-text input). */
export const MAX_TOKENS_MIN = 1;
export const MAX_TOKENS_MAX = 32_768;
export const DEFAULT_MAX_TOKENS = 2048;

/** localStorage key for the persisted generation settings. */
export const GENERATION_SETTINGS_STORAGE_KEY = "woa-generation-settings";

interface GenerationSettingsState {
  /** Sampling temperature (0–2). */
  temperature: number;
  /** Maximum tokens to generate. */
  maxTokens: number;

  /** Set the temperature, clamped to [TEMPERATURE_MIN, TEMPERATURE_MAX]. */
  setTemperature: (value: number) => void;
  /** Set max tokens, clamped to [MAX_TOKENS_MIN, MAX_TOKENS_MAX] (integer). */
  setMaxTokens: (value: number) => void;
}

/** Clamp `value` into `[min, max]`; returns `fallback` for a non-finite value. */
function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export const useGenerationSettings = create<GenerationSettingsState>()(
  persist(
    (set) => ({
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,

      setTemperature: (value) =>
        set({
          temperature: clamp(
            value,
            TEMPERATURE_MIN,
            TEMPERATURE_MAX,
            DEFAULT_TEMPERATURE,
          ),
        }),
      setMaxTokens: (value) =>
        set({
          maxTokens: Math.round(
            clamp(value, MAX_TOKENS_MIN, MAX_TOKENS_MAX, DEFAULT_MAX_TOKENS),
          ),
        }),
    }),
    {
      name: GENERATION_SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the values, not the action fns.
      partialize: (state) => ({
        temperature: state.temperature,
        maxTokens: state.maxTokens,
      }),
    },
  ),
);

/**
 * Read the current generation params as the AI request-body field names
 * (`temperature` / `max_tokens`). Used by the AI endpoint functions to attach
 * the persisted params to every generation call (non-React access).
 */
export function currentGenerationParams(): {
  temperature: number;
  max_tokens: number;
} {
  const { temperature, maxTokens } = useGenerationSettings.getState();
  return { temperature, max_tokens: maxTokens };
}
