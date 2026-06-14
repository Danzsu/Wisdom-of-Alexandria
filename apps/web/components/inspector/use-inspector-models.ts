"use client";

import { useMemo } from "react";
import { useModels } from "@/lib/api/ai-hooks";
import { useEditorStore } from "@/lib/stores/editor-store";
import { hu } from "@/lib/i18n/hu";
import type { ModelGroup } from "@/components/kit/model-selector";

export interface InspectorModels {
  /** Grouped models for the ModelSelector (Lokális / Felhő), config-driven. */
  groups: ModelGroup[];
  /** The resolved active model id (store choice → backend default → ""). */
  value: string;
  /** Select a model (persists in the editor store). */
  setValue: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Adapt the backend `/ai/models` list into the kit ModelSelector shape and wire
 * the selection to the editor store. Model names are NEVER hardcoded here — they
 * come entirely from the backend/ModelRouter config. Local models group under
 * "Lokális", cloud under "Felhő".
 */
export function useInspectorModels(): InspectorModels {
  const models = useModels();
  const storeModel = useEditorStore((s) => s.activeModel);
  const setActiveModel = useEditorStore((s) => s.setActiveModel);

  const groups = useMemo<ModelGroup[]>(() => {
    const all = models.data?.models ?? [];
    const local = all.filter((m) => m.kind === "local");
    const cloud = all.filter((m) => m.kind === "cloud");
    const out: ModelGroup[] = [];
    if (local.length > 0) {
      out.push({
        label: hu.inspector.modelLocalGroup,
        models: local.map((m) => ({
          id: m.id,
          label: m.label,
          kind: m.kind,
          moderated: m.moderated,
        })),
      });
    }
    if (cloud.length > 0) {
      out.push({
        label: hu.inspector.modelCloudGroup,
        models: cloud.map((m) => ({
          id: m.id,
          label: m.label,
          kind: m.kind,
          moderated: m.moderated,
        })),
      });
    }
    return out;
  }, [models.data]);

  const value = storeModel ?? models.data?.default ?? "";

  return {
    groups,
    value,
    setValue: setActiveModel,
    isLoading: models.isLoading,
    isError: models.isError,
    error: models.error,
  };
}
