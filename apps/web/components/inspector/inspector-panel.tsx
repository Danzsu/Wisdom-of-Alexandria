"use client";

import { useEditorStore } from "@/lib/stores/editor-store";
import { hu } from "@/lib/i18n/hu";
import { ErrorBoundary } from "@/components/kit/error-boundary";
import { InspectorTabBar } from "./inspector-tab-bar";
import { AiTab } from "./ai-tab";
import { CodexTab } from "./codex-tab";
import { BeatsTab } from "./beats-tab";
import { RevisionsTab } from "./revisions-tab";
import { WarningsTab } from "./warnings-tab";
import { MetaTab } from "./meta-tab";

/**
 * The AI Inspector panel mounted in the AppShell's reserved 360px slot on the
 * Write route. A 48px vertical tab bar (AI / Codex / Beatek / Figyelmeztetések /
 * Meta) over a scrolling body that swaps the active tab. The panel is wrapped in
 * the AI generation provider by the shell so the editor + the AI tab share one
 * generation/accept flow.
 */
export function InspectorPanel() {
  const inspectorTab = useEditorStore((s) => s.inspectorTab);

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={hu.inspector.panelAria}>
      <InspectorTabBar />
      {/* One pane throwing degrades the inspector body locally (compact in-pane
          fallback) instead of bubbling to the route boundary. Keyed on the tab
          so switching tabs re-mounts a clean subtree. */}
      <ErrorBoundary key={inspectorTab}>
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pb-7 pt-4">
          {inspectorTab === "ai" ? <AiTab /> : null}
          {inspectorTab === "codex" ? <CodexTab /> : null}
          {inspectorTab === "beats" ? <BeatsTab /> : null}
          {inspectorTab === "revisions" ? <RevisionsTab /> : null}
          {inspectorTab === "warnings" ? <WarningsTab /> : null}
          {inspectorTab === "meta" ? <MetaTab /> : null}
        </div>
      </ErrorBoundary>
    </div>
  );
}
