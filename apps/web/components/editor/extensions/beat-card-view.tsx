"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { X, Check, RotateCcw, Sparkles } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { ProgressBar } from "@/components/kit/progress-bar";
import { cn, countWords } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { useGenerateScene, useApproveRevision } from "@/lib/api/ai-hooks";

/** Per-card state machine: config → generating → ready → (applied = removed). */
export type BeatCardState = "config" | "generating" | "ready";
export type BeatWordChoice = "200" | "400" | "600";

/**
 * Legacy stub preview kept exported for older tests; the real card now renders
 * the generated revision content from the backend, never this constant.
 */
export const BEAT_STUB_PREVIEW =
  "Damianosz közelebb lépett, és a lámpás fénye most kettőjük árnyékát vetette a polcokra. A jelek, mintha megérezték volna a második szempár súlyát, halványulni kezdtek — Szelene tenyere ösztönösen a pergamen fölé simult, ahogy az ember a gyertyalángot óvja a huzattól. — Mióta tudsz róla? — kérdezte az őr, és hangjából eltűnt a szemrehányás.";

/** Map the word-count chip to a target word count integer for the request. */
function wordTarget(words: BeatWordChoice): number {
  return Number.parseInt(words, 10);
}

/**
 * NodeView for the inline scene-beat card. Drives the config→generating→ready
 * machine; generation now calls the REAL generate-scene-from-beats endpoint
 * (M5). The result is a Revision (`approved: false`) — Apply APPROVES it, then
 * inserts the approved text into the manuscript (never an auto-write). Retry
 * regenerates; Discard removes the card without touching the manuscript.
 */
export function BeatCardView({
  node,
  updateAttributes,
  editor,
  getPos,
  deleteNode,
  extension,
}: NodeViewProps) {
  const words = (node.attrs.words as BeatWordChoice) ?? "400";
  // The active model is config-driven (the page threads it into the extension
  // option from `useModels`); fall back to the option's own placeholder. Never a
  // hardcoded production model name here.
  const modelName = (extension.options.modelName as string) ?? "—";
  const sceneId = (extension.options.sceneId as string | undefined) ?? undefined;
  const onGenerate = extension.options.onGenerate as
    | ((words: BeatWordChoice) => void)
    | undefined;
  const onApply = extension.options.onApply as (() => void) | undefined;
  const onDiscard = extension.options.onDiscard as (() => void) | undefined;

  // The beat to dramatize. The state machine + result text live in React local
  // state (transient UI), not the doc — only the accepted prose enters the doc.
  const [beat, setBeat] = useState("");
  const [result, setResult] = useState<{
    revisionId: string;
    content: string;
    model: string;
  } | null>(null);

  const generateMutation = useGenerateScene();
  const approveMutation = useApproveRevision();
  let state: BeatCardState = "config";
  if (generateMutation.isPending) state = "generating";
  else if (result) state = "ready";

  const generate = () => {
    onGenerate?.(words);
    setResult(null);
    generateMutation.mutate(
      {
        beats: [beat.trim() || hu.write.beatDefaultBeat],
        scene_id: sceneId ?? null,
        model: modelName === "—" ? undefined : modelName,
        style_notes: `${wordTarget(words)} szó`,
      },
      {
        onSuccess: (res) => {
          setResult({
            revisionId: res.revision.id,
            content: res.revision.content,
            model: res.revision.model_name ?? modelName,
          });
        },
        // Errors surface via generateMutation.isError below (never swallowed).
      },
    );
  };

  const apply = () => {
    if (!result) return;
    // Human-in-the-loop: approve the revision, THEN insert the approved text
    // before the card and remove the card. Insert only on approve success.
    approveMutation.mutate(result.revisionId, {
      onSuccess: () => {
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos != null) {
          editor
            .chain()
            .focus()
            .insertContentAt(pos, {
              type: "paragraph",
              content: [{ type: "text", text: result.content }],
            })
            .run();
        }
        onApply?.();
        deleteNode();
      },
    });
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
        <>
          <textarea
            value={beat}
            onChange={(e) => setBeat(e.target.value)}
            rows={2}
            aria-label={hu.write.beatInputAria}
            placeholder={hu.write.beatInputPlaceholder}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 font-sans text-[13px] leading-[1.5] text-text outline-none placeholder:text-text-faint focus-visible:border-accent"
          />
          <button
            type="button"
            className="flex h-[34px] items-center justify-center gap-[7px] rounded-lg border-none bg-accent-strong text-[13px] font-semibold text-accent-fg hover:bg-accent-hover"
            onClick={generate}
          >
            <Icon icon={Sparkles} size={14} className="fill-current" />
            {hu.write.beatGenerate}
          </button>
          {generateMutation.isError ? (
            <p className="m-0 text-[12px] text-danger-text" role="alert">
              {hu.write.beatError}: {generateMutation.error.message}
            </p>
          ) : null}
        </>
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

      {state === "ready" && result ? (
        <>
          <p className="m-0 font-serif text-[14px] leading-[1.65] text-text-soft">
            {result.content}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={approveMutation.isPending}
              className="flex h-[30px] items-center gap-1.5 rounded-lg border-none bg-success px-[11px] text-[12px] font-semibold text-success-fg hover:opacity-90 disabled:opacity-50"
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
              {hu.write.beatReadyMeta(countWords(result.content), result.model)}
            </span>
          </div>
          {approveMutation.isError ? (
            <p className="m-0 text-[12px] text-danger-text" role="alert">
              {hu.write.beatApplyError}: {approveMutation.error.message}
            </p>
          ) : null}
        </>
      ) : null}
    </NodeViewWrapper>
  );
}
