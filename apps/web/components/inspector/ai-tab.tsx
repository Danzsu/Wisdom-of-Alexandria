"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  RotateCcw,
  Eye,
  ChevronsUpDown,
  Shrink,
  MessageSquare,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { Textarea } from "@/components/kit/textarea";
import { ModelSelector } from "@/components/kit/model-selector";
import { AIResultCard } from "@/components/kit/ai-result-card";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";
import { useEditorStore, type AiPanelView } from "@/lib/stores/editor-store";
import { GeneratingCard } from "./generating-card";
import { DescribePanel } from "./describe-panel";
import { BrainstormPanel } from "./brainstorm-panel";
import { useInspectorModels } from "./use-inspector-models";
import {
  useAiGeneration,
  type AiActionKind,
} from "./ai-generation-context";

/** The grid entries that open a SUB-PANEL instead of firing a generation. */
type PanelActionId = Extract<AiPanelView, "describe" | "brainstorm">;

/** The action grid (Átírás primary). "Leírás" / "Ötletelés" open sub-panels. */
const GRID: {
  id: AiActionKind | PanelActionId;
  label: string;
  icon: typeof RotateCcw;
}[] = [
  { id: "rewrite", label: hu.inspector.actRewrite, icon: RotateCcw },
  { id: "describe", label: hu.inspector.actDescribe, icon: Eye },
  { id: "expand", label: hu.inspector.actExpand, icon: ChevronsUpDown },
  { id: "compress", label: hu.inspector.actCompress, icon: Shrink },
  { id: "dialog", label: hu.inspector.actDialog, icon: MessageSquare },
  { id: "fix", label: hu.inspector.actFix, icon: Sparkles },
  { id: "brainstorm", label: hu.inspector.actBrainstorm, icon: Lightbulb },
];

/**
 * The AI inspector tab. Shows the selected-text QuoteBox, the 2×3 action grid,
 * the custom-instruction field, the config-driven ModelSelector and the
 * Generálás button; then the GeneratingCard → AIResultCard flow. "Leírás" swaps
 * to the 6-channel Describe panel. Nothing is inserted until the user accepts.
 */
export function AiTab() {
  const aiSelection = useEditorStore((s) => s.aiSelection);
  const models = useInspectorModels();
  const gen = useAiGeneration();
  const [instruction, setInstruction] = useState("");
  // The sub-panel view lives in the STORE (not local state) so the Write page
  // can open a specific panel across the route boundary (the toolbar's
  // Ötletelés action sets it to "brainstorm").
  const view = useEditorStore((s) => s.aiPanelView);
  const setView = useEditorStore((s) => s.setAiPanelView);

  if (view === "describe") {
    return <DescribePanel onBack={() => setView("main")} />;
  }
  if (view === "brainstorm") {
    return <BrainstormPanel onBack={() => setView("main")} />;
  }

  const hasSelection = Boolean(aiSelection && aiSelection.text.trim().length > 0);
  const selectionText = aiSelection?.text ?? "";

  const onGridClick = (id: AiActionKind | PanelActionId) => {
    if (id === "describe" || id === "brainstorm") {
      setView(id);
      return;
    }
    gen.trigger(id, instruction);
  };

  return (
    // AI-zone live region (design: role="region" aria-label="AI segéd"
    // aria-live="polite"): a named <section> landmark (implicit region role)
    // whose polite announcements let screen-readers hear the generating→ready
    // flow — the GeneratingCard announces the start via its own role="status",
    // and the RESULT card's arrival is announced by this region on mount.
    <section
      aria-label={hu.inspector.panelAria}
      aria-live="polite"
      className="flex flex-col gap-3.5"
    >
      {/* Section header: "AI segéd" label (per design). Model shown in selector below. */}
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.07em] text-ai-text">
        {hu.inspector.panelAria}
      </p>

      {/* Selected-text QuoteBox (Literata italic). */}
      <div>
        <p className="m-0 mb-[7px] text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {hu.inspector.selectedTextLabel}
        </p>
        {hasSelection ? (
          <div className="rounded-[10px] border border-border bg-surface-muted px-3 py-2.5 font-serif text-[13px] italic leading-[1.6] text-text-soft">
            {`„${selectionText}"`}
          </div>
        ) : (
          <p className="m-0 text-[12px] leading-[1.5] text-text-muted">
            {hu.inspector.noSelectionHint}
          </p>
        )}
      </div>

      {/* 2×3 action grid. */}
      <div className="grid grid-cols-2 gap-2">
        {GRID.map((action, index) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onGridClick(action.id)}
            className={cn(
              "flex h-[38px] items-center gap-2 rounded-[10px] border bg-surface px-[11px] text-[13px] text-text-soft transition-colors hover:border-accent hover:bg-accent-muted hover:text-accent-text",
              index === 0
                ? "border-accent bg-accent-muted text-accent-text"
                : "border-border",
            )}
          >
            <Icon icon={action.icon} size={14} />
            {action.label}
          </button>
        ))}
      </div>

      {/* Custom instruction. */}
      <Textarea
        rows={3}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        aria-label={hu.inspector.customInstructionAria}
        placeholder={hu.inspector.customInstructionPlaceholder}
        className="resize-none"
      />

      {/* Model selector (config-driven). */}
      {models.isLoading ? (
        <p className="m-0 text-[12px] text-text-muted">
          {hu.inspector.modelsLoading}
        </p>
      ) : models.isError ? (
        <p className="m-0 text-[12px] text-danger-text" role="alert">
          {hu.inspector.modelsError}: {models.error?.message}
        </p>
      ) : (
        <ModelSelector
          groups={models.groups}
          value={models.value}
          onChange={models.setValue}
        />
      )}

      {/* Generálás CTA — uses --ai purple per the design's generate button spec. */}
      <button
        type="button"
        onClick={() => gen.trigger("rewrite", instruction)}
        disabled={gen.isGenerating || !hasSelection}
        className="woa-cta flex h-[42px] w-full items-center justify-center gap-2 rounded-[11px] border-none bg-ai text-[13.5px] font-semibold text-ai-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon icon={Sparkles} size={15} className="fill-current" />
        {hu.inspector.generate}
      </button>

      {/* Generating → result flow. */}
      {gen.isGenerating ? <GeneratingCard /> : null}

      {gen.error && !gen.isGenerating ? (
        <p className="m-0 text-[12px] text-danger-text" role="alert">
          {hu.inspector.generationError}: {gen.error.message}
        </p>
      ) : null}

      {/* AnimatePresence lets the result card play its FM exit on accept/reject
          before unmount; without a wrapping presence the card would just vanish.
          Reduced motion → the card's no-op variants make exit instant. */}
      <AnimatePresence>
        {gen.pending && !gen.isGenerating ? (
          <AIResultCard
            label={hu.inspector.resultLabel[gen.pending.action] ?? hu.inspector.tabAi}
            version={gen.pending.version || undefined}
            model={gen.pending.model}
            contextEntities={gen.pending.contextEntities}
            body={gen.pending.content}
            busy={gen.isAccepting}
            onAccept={gen.accept}
            onReject={gen.reject}
            onCopy={gen.copy}
            onStar={gen.star}
          />
        ) : null}
      </AnimatePresence>

      {!gen.pending && !gen.isGenerating ? (
        <p className="m-0 text-center text-[11px] text-text-muted">
          {hu.inspector.disclaimer}
        </p>
      ) : null}
    </section>
  );
}
