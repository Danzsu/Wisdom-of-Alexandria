"use client";

import {
  Sparkles,
  Database,
  Activity,
  History,
  TriangleAlert,
  Info,
} from "lucide-react";
import { Tab, TabBar } from "@/components/kit/tab";
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
 * The 48px inspector tab row: five vertical icon-over-label tabs (reusing the
 * kit Tab `vertical` variant). Active tab + selection live in the editor store
 * so the panel body and any deep-link can read it.
 */
export function InspectorTabBar() {
  const inspectorTab = useEditorStore((s) => s.inspectorTab);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);

  return (
    <TabBar
      aria-label={hu.inspector.tabBarAria}
      className="h-12 flex-none gap-0"
    >
      {TABS.map((tab) => (
        <Tab
          key={tab.id}
          orientation="vertical"
          active={inspectorTab === tab.id}
          icon={<Icon icon={tab.icon} size={16} />}
          onClick={() => setInspectorTab(tab.id)}
        >
          {tab.label}
        </Tab>
      ))}
    </TabBar>
  );
}
