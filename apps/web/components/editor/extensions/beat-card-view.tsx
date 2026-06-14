"use client";

import { useEffect, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { X, Check, RotateCcw, Sparkles } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { ProgressBar } from "@/components/kit/progress-bar";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { countWords } from "@/lib/utils";

/** Per-card state machine: config → generating → ready → (applied = removed). */
export type BeatCardState = "config" | "generating" | "ready";
export type BeatWordChoice = "200" | "400" | "600";

/** Demo preview text inserted on Apply (the real generation is M5). */
export const BEAT_STUB_PREVIEW =
  "Damianosz közelebb lépett, és a lámpás fénye most kettőjük árnyékát vetette a polcokra. A jelek, mintha megérezték volna a második szempár súlyát, halványulni kezdtek — Szelene tenyere ösztönösen a pergamen fölé simult, ahogy az ember a gyertyalángot óvja a huzattól. — Mióta tudsz róla? — kérdezte az őr, és hangjából eltűnt a szemrehányás.";

/**
 * NodeView for the inline scene-beat card. Drives the hidden→config→
 * generating→ready→applied machine inside the node's own attrs:
 * - `config`:    word-count chips (200/400/600) + Generate CTA
 * - `generating`: spinner + indeterminate progress (the real model call is M5,
 *   so generation is a stubbed timer → `ready`)
 * - `ready`:     Literata preview + Alkalmaz / Újra / Elvet
 * - apply:       inserts the (stub) prose as a paragraph and removes the card
 */
export function BeatCardView({ node, updateAttributes, editor, getPos, deleteNode, extension }: NodeViewProps) {
  const state = (node.attrs.state as BeatCardState) ?? "config";
  const words = (node.attrs.words as BeatWordChoice) ?? "400";
  const modelName = (extension.options.modelName as string) ?? "ollama/llama3.2";
  const onGenerate = extension.options.onGenerate as (() => void) | undefined;
  const onApply = extension.options.onApply as (() => void) | undefined;
  const onDiscard = extension.options.onDiscard as (() => void) | undefined;

  // Stubbed generation timer (M5 replaces with a real ModelRouter call). Cleared
  // on unmount / state change so no timer leaks.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state !== "generating") return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      updateAttributes({ state: "ready" });
    }, 1600);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state, updateAttributes]);

  const generate = () => {
    onGenerate?.();
    updateAttributes({ state: "generating" });
  };

  const apply = () => {
    // Insert the stub prose right before the card, then remove the card.
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos != null) {
      editor
        .chain()
        .focus()
        .insertContentAt(pos, {
          type: "paragraph",
          content: [{ type: "text", text: BEAT_STUB_PREVIEW }],
        })
        .run();
    }
    onApply?.();
    deleteNode();
  };

  const discard = () => {
    onDiscard?.();
    deleteNode();
  };

  const wordBtn = (value: BeatWordChoice) => (
    <button
      type="button"
      data-state={words === value ? "on" : "off"}
      className={cn(
        "h-[26px] rounded-lg border border-border bg-surface px-2.5 text-[12px] tabular-nums text-text-soft hover:border-border-strong",
        words === value && "border-accent bg-accent-muted text-accent-text",
      )}
      onClick={() => updateAttributes({ words: value })}
    >
      {value}
    </button>
  );

  return (
    <NodeViewWrapper
      as="div"
      data-beat-card=""
      data-beat-state={state}
      className="mb-[18px] flex flex-col gap-[11px] rounded-xl border border-l-[3px] border-border border-l-accent bg-surface p-3.5 font-sans shadow-panel"
    >
      <div className="flex items-center gap-1.5">
        {wordBtn("200")}
        {wordBtn("400")}
        {wordBtn("600")}
        <span className="text-[11px] text-text-muted">
          {hu.write.beatWordsSuffix}
        </span>
        <div className="flex-1" />
        <span className="flex h-5 items-center rounded-full bg-ai-muted px-2 text-[10px] font-semibold text-ai-text">
          {modelName}
        </span>
        <button
          type="button"
          aria-label={hu.write.beatDiscardAria}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          onClick={discard}
        >
          <Icon icon={X} size={13} />
        </button>
      </div>

      {state === "config" ? (
        <button
          type="button"
          className="flex h-[34px] items-center justify-center gap-[7px] rounded-lg border-none bg-accent-strong text-[13px] font-semibold text-accent-fg hover:bg-accent-hover"
          onClick={generate}
        >
          <Icon icon={Sparkles} size={14} className="fill-current" />
          {hu.write.beatGenerate}
        </button>
      ) : null}

      {state === "generating" ? (
        <>
          <div className="flex items-center gap-2">
            <Spinner size={14} />
            <span className="text-[13px] text-text-muted">
              {hu.write.beatGenerating}
            </span>
          </div>
          <ProgressBar indeterminate aria-label={hu.write.beatGenerating} />
        </>
      ) : null}

      {state === "ready" ? (
        <>
          <p className="m-0 font-serif text-[14px] leading-[1.65] text-text-soft">
            {BEAT_STUB_PREVIEW}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="flex h-[30px] items-center gap-1.5 rounded-lg border-none bg-success px-[11px] text-[12px] font-semibold text-success-fg hover:opacity-90"
              onClick={apply}
            >
              <Icon icon={Check} size={12} strokeWidth={2} />
              {hu.write.beatApply}
            </button>
            <button
              type="button"
              className="flex h-[30px] items-center gap-1.5 rounded-lg border border-border bg-transparent px-[11px] text-[12px] text-text-soft hover:bg-surface-muted"
              onClick={generate}
            >
              <Icon icon={RotateCcw} size={12} />
              {hu.write.beatRetry}
            </button>
            <button
              type="button"
              className="flex h-[30px] items-center gap-1.5 rounded-lg border border-border bg-transparent px-[11px] text-[12px] text-text-soft hover:bg-surface-muted"
              onClick={discard}
            >
              <Icon icon={X} size={12} />
              {hu.write.beatDiscard}
            </button>
            <div className="flex-1" />
            <span className="text-[11px] tabular-nums text-text-muted">
              {hu.write.beatReadyMeta(countWords(BEAT_STUB_PREVIEW), modelName)}
            </span>
          </div>
        </>
      ) : null}
    </NodeViewWrapper>
  );
}
