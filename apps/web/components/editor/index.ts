/** Manuscript editor barrel (M4 Write View). */
export { ManuscriptEditor, STATIC_MODEL_NAME } from "./manuscript-editor";
export { AiToolbar, type ToolbarAction } from "./ai-toolbar";
export { FormatMenu } from "./format-menu";
export { CleanWriteBar } from "./clean-write-bar";
export {
  StoryTimelineRail,
  scenesToTimeline,
  type TimelineScene,
} from "./story-timeline-rail";
export {
  SelectionBubbleMenu,
  type BubbleAction,
} from "./selection-bubble-menu";
export { SlashMenu, buildSlashItems, type SlashMenuCallbacks } from "./slash-menu";
export { useAutosave, AUTOSAVE_DELAY_MS } from "./use-autosave";
export { textToDoc } from "./manuscript-content";
