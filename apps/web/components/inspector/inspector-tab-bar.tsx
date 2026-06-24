"use client";

import {
  Sparkles,
  Database,
  Activity,
  History,
  TriangleAlert,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";
import {
  useEditorStore,
  type InspectorTab,
} from "@/lib/stores/editor-store";

/** The five inspector tabs, in prototype order, with their icon + label. */
const TABS: { id: InspectorTab; label: string; icon: typeof Sparkles }[] = [
  { id: "ai", label: hu.inspector.tabAi, icon: Sparkles },
  { id: "codex", label: hu.inspector.tabCodex, icon: Database },
  { id: "beats", label: hu.inspector.tabBeats, icon: Activity },
  { id: "revisions", label: hu.inspector.tabRevisions, icon: History },
  { id: "warnings", label: hu.inspector.tabWarnings, icon: TriangleAlert },
  { id: "meta", label: hu.inspector.tabMeta, icon: Info },
];

/**
 * The inspector tab row: six vertical icon-over-label segment tabs.
 * Rendered as a segmented control (surface-muted pill background, active tab
 * gets surface + shadow-card) — matching the design's `woa-seg` pattern.
 * Active tab + selection live in the editor store.
 */
export function InspectorTabBar() {
  const inspectorTab = useEditorStore((s) => s.inspectorTab);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);

  return (
    <div
      role="tablist"
      aria-label={hu.inspector.tabBarAria}
      className="mx-3 my-2.5 flex flex-none gap-0.5 rounded-[10px] bg-surface-muted p-[3px]"
    >
      {TABS.map((tab) => {
        const active = inspectorTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => setInspectorTab(tab.id)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-[3px] rounded-[8px] border-none py-[6px] text-[10px] font-semibold transition-all",
              active
                ? "bg-surface text-text shadow-card"
                : "bg-transparent text-text-muted hover:text-text",
            )}
          >
            <Icon icon={tab.icon} size={14} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
