/** AI Inspector barrel (M5 — AI flow + human-in-the-loop). */
export { InspectorPanel } from "./inspector-panel";
export { InspectorTabBar } from "./inspector-tab-bar";
export { AiTab } from "./ai-tab";
export { DescribePanel } from "./describe-panel";
export { CodexTab } from "./codex-tab";
export { BeatsTab } from "./beats-tab";
export { SceneBeatsPanel } from "./scene-beats-panel";
export { WarningsTab } from "./warnings-tab";
export { MetaTab } from "./meta-tab";
export { GeneratingCard } from "./generating-card";
export {
  AiGenerationProvider,
  useAiGeneration,
  type AiActionKind,
  type PendingResult,
} from "./ai-generation-context";
export { useInspectorModels } from "./use-inspector-models";
export { useInspectorScene } from "./use-inspector-scene";
