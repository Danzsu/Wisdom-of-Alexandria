import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  GENERATION_SETTINGS_STORAGE_KEY,
  currentGenerationParams,
  useGenerationSettings,
} from "@/lib/stores/generation-settings-store";

describe("generation-settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    useGenerationSettings.setState({
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
    });
  });

  it("exposes the prototype defaults", () => {
    expect(useGenerationSettings.getState().temperature).toBe(0.8);
    expect(useGenerationSettings.getState().maxTokens).toBe(2048);
  });

  it("clamps temperature into [0, 2]", () => {
    useGenerationSettings.getState().setTemperature(1.4);
    expect(useGenerationSettings.getState().temperature).toBeCloseTo(1.4);

    useGenerationSettings.getState().setTemperature(5);
    expect(useGenerationSettings.getState().temperature).toBe(2);

    useGenerationSettings.getState().setTemperature(-1);
    expect(useGenerationSettings.getState().temperature).toBe(0);
  });

  it("rounds + clamps max tokens", () => {
    useGenerationSettings.getState().setMaxTokens(4096.7);
    expect(useGenerationSettings.getState().maxTokens).toBe(4097);

    useGenerationSettings.getState().setMaxTokens(0);
    expect(useGenerationSettings.getState().maxTokens).toBe(1);
  });

  it("persists to localStorage under the documented key", async () => {
    useGenerationSettings.getState().setTemperature(1.1);
    useGenerationSettings.getState().setMaxTokens(1024);

    // zustand/persist writes synchronously to localStorage after a set.
    const raw = localStorage.getItem(GENERATION_SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      state: { temperature: number; maxTokens: number };
    };
    expect(parsed.state.temperature).toBeCloseTo(1.1);
    expect(parsed.state.maxTokens).toBe(1024);
  });

  it("currentGenerationParams returns the request-body field names", () => {
    useGenerationSettings.getState().setTemperature(0.5);
    useGenerationSettings.getState().setMaxTokens(512);
    expect(currentGenerationParams()).toEqual({
      temperature: 0.5,
      max_tokens: 512,
    });
  });
});
