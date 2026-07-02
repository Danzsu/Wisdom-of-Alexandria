"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Copy, Lightbulb, Star } from "lucide-react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/kit/icon";
import { Textarea } from "@/components/kit/textarea";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useCalmMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/stores/editor-store";
import {
  useBookProjectId,
  useBrainstorm,
  useCreateSnippet,
} from "@/lib/api/ai-hooks";
import { GeneratingCard } from "./generating-card";

/**
 * The selectable idea counts (all within the backend's 1–10 bound; the middle
 * one is the backend default). Chips, not a free number field — the same
 * quick-pick pattern as the beat card's word-count chips.
 */
const IDEA_COUNTS = [3, 5, 8] as const;

/** The backend's default `count` (pre-selected chip). */
const DEFAULT_COUNT = 5;

/**
 * Ötletelés (brainstorm) sub-panel — Sudowrite-style idea generation for a
 * topic/question, grounded via scene-scoped RAG when the route carries a scene.
 * The topic prefills from the captured selection.
 *
 * Ideas are NOT manuscript text: the endpoint returns NO revision, so there is
 * no approve/insert path at all here — each idea card offers Copy and
 * "Snippet mentése" only. Errors surface as a toast (never swallowed).
 */
export function BrainstormPanel({ onBack }: Readonly<{ onBack: () => void }>) {
  const params = useParams<{ bookId?: string; sceneId?: string }>();
  const bookId = params?.bookId;
  const sceneId = params?.sceneId;

  // Prefill ONCE from the selection captured when the panel was opened; the
  // field stays user-editable afterwards.
  const aiSelection = useEditorStore((s) => s.aiSelection);
  const [topic, setTopic] = useState(aiSelection?.text ?? "");
  const [count, setCount] = useState<number>(DEFAULT_COUNT);
  const [ideas, setIdeas] = useState<string[] | null>(null);

  const brainstormMutation = useBrainstorm();
  const projectIdQuery = useBookProjectId(bookId);
  const snippetMutation = useCreateSnippet();
  const motionConf = useCalmMotion();

  const canRun = topic.trim().length > 0 && !brainstormMutation.isPending;

  const run = () => {
    if (!canRun) return;
    setIdeas(null);
    brainstormMutation.mutate(
      {
        topic: topic.trim(),
        count,
        scene_id: sceneId ?? null,
      },
      {
        onSuccess: (res) => setIdeas(res.ideas),
        // Error toast — the mutation error is never swallowed.
        onError: (e) => toast(`${hu.inspector.brainstormError}: ${e.message}`),
      },
    );
  };

  const copyIdea = (idea: string) => {
    void navigator.clipboard
      .writeText(idea)
      .then(() => toast(hu.write.toastCopied))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Vágólap-hiba";
        toast(message);
      });
  };

  const starIdea = (idea: string) => {
    const projectId = projectIdQuery.data;
    if (!projectId) {
      toast(projectIdQuery.error?.message ?? hu.projects.openProjectError);
      return;
    }
    snippetMutation.mutate(
      {
        projectId,
        data: {
          title: hu.inspector.brainstormTitle,
          content: idea,
          source_scene_id: sceneId ?? null,
          tags: [],
        },
      },
      {
        onSuccess: () => toast(hu.write.toastSnippetSaved),
        onError: (e) => toast(e.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {hu.inspector.brainstormTitle}
        </span>
        <button
          type="button"
          aria-label={hu.inspector.brainstormBackAria}
          onClick={onBack}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <Icon icon={X} size={14} />
        </button>
      </div>

      {/* Topic (prefilled from the selection when one was captured). */}
      <div>
        <p className="m-0 mb-[7px] text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {hu.inspector.brainstormTopicLabel}
        </p>
        <Textarea
          rows={3}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-label={hu.inspector.brainstormTopicAria}
          placeholder={hu.inspector.brainstormTopicPlaceholder}
          className="resize-none"
        />
      </div>

      {/* Idea count (quick-pick chips; the backend default pre-selected). */}
      <div>
        <p className="m-0 mb-[7px] text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {hu.inspector.brainstormCountLabel}
        </p>
        <div className="flex items-center gap-1.5">
          {IDEA_COUNTS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={count === value}
              onClick={() => setCount(value)}
              className={cn(
                "flex h-7 min-w-9 items-center justify-center rounded-full border px-3 text-[12.5px] transition-colors",
                count === value
                  ? "border-ai bg-ai-muted font-semibold text-ai-text"
                  : "border-border bg-surface text-text-soft hover:border-ai hover:text-ai-text",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* Run — the --ai purple CTA, matching the main tab's generate button. */}
      <button
        type="button"
        onClick={run}
        disabled={!canRun}
        className="woa-cta flex h-[42px] w-full items-center justify-center gap-2 rounded-[11px] border-none bg-ai text-[13.5px] font-semibold text-ai-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon icon={Lightbulb} size={15} />
        {hu.inspector.brainstormRun}
      </button>

      {brainstormMutation.isPending ? <GeneratingCard /> : null}

      {/* Idea cards — copy / star only; ideas are never inserted. */}
      <AnimatePresence initial={false}>
        {ideas && !brainstormMutation.isPending ? (
          <motion.div
            className="flex flex-col gap-2.5"
            variants={motionConf.staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {hu.inspector.brainstormIdeasLabel}
            </p>
            {ideas.map((idea) => (
              <motion.div
                key={idea}
                variants={motionConf.staggerChild}
                className="rounded-[10px] border border-ai/20 bg-ai-muted px-3 py-2.5"
              >
                <p className="m-0 mb-1.5 font-serif text-[13px] leading-[1.6] text-text-soft">
                  {idea}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyIdea(idea)}
                    className="flex h-6 items-center gap-1.5 rounded-md bg-transparent px-2 text-[11px] text-text-muted hover:bg-surface hover:text-accent-text"
                  >
                    <Icon icon={Copy} size={11} />
                    {hu.inspector.brainstormCopy}
                  </button>
                  <button
                    type="button"
                    onClick={() => starIdea(idea)}
                    className="flex h-6 items-center gap-1.5 rounded-md bg-transparent px-2 text-[11px] text-text-muted hover:bg-surface hover:text-accent-text"
                  >
                    <Icon icon={Star} size={11} />
                    {hu.inspector.saveSnippet}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="m-0 text-center text-[11px] text-text-muted">
        {hu.inspector.brainstormFootnote}
      </p>
    </div>
  );
}
