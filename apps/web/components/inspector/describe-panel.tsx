"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ChevronRight,
  Eye,
  AudioLines,
  Hand,
  Wind,
  Droplet,
  Brain,
  Star,
} from "lucide-react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useCalmMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/stores/editor-store";
import {
  useDescribe,
  useBookProjectId,
  useCreateSnippet,
} from "@/lib/api/ai-hooks";
import type { DescribeChannel } from "@/lib/api/ai-types";

/**
 * One sensory channel: the UI label (prototype) + the backend channel id (sent
 * as the `channels` param — must match `AIService.DESCRIBE_CHANNELS` exactly).
 */
interface Channel {
  /** Backend channel id (exact). */
  id: DescribeChannel;
  /** UI label (prototype). */
  label: string;
  icon: typeof Eye;
}

const CHANNELS: Channel[] = [
  { id: "Látás", label: hu.inspector.channelSight, icon: Eye },
  { id: "Hang", label: hu.inspector.channelSound, icon: AudioLines },
  { id: "Tapintás", label: hu.inspector.channelTouch, icon: Hand },
  { id: "Szag", label: hu.inspector.channelSmell, icon: Wind },
  { id: "Íz", label: hu.inspector.channelTaste, icon: Droplet },
  { id: "Metaforák", label: hu.inspector.channelMetaphor, icon: Brain },
];

/**
 * Describe sub-panel — the 6-channel sensory accordion (an MVP feature). Each
 * channel, when opened, calls the REAL describe endpoint with that single
 * channel and renders the returned Literata alternatives, each with a "Snippet
 * mentése" button (Star → POST a snippet). Suggestions never auto-insert.
 */
export function DescribePanel({ onBack }: Readonly<{ onBack: () => void }>) {
  const aiSelection = useEditorStore((s) => s.aiSelection);
  const selectionText = aiSelection?.text ?? "";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {hu.inspector.describeTitle}
        </span>
        <button
          type="button"
          aria-label={hu.inspector.describeBackAria}
          onClick={onBack}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <Icon icon={X} size={14} />
        </button>
      </div>

      {selectionText.trim().length > 0 ? (
        <div className="rounded-[10px] border border-border bg-surface-muted px-3 py-2.5 font-serif text-[13px] italic leading-[1.6] text-text-soft">
          {`„${selectionText}"`}
        </div>
      ) : (
        <p className="m-0 text-[12px] leading-[1.5] text-text-muted">
          {hu.inspector.noSelectionHint}
        </p>
      )}

      <div className="flex flex-col overflow-hidden rounded-xl border border-border">
        {CHANNELS.map((channel, index) => (
          <ChannelRow
            key={channel.id}
            channel={channel}
            selectionText={selectionText}
            isLast={index === CHANNELS.length - 1}
          />
        ))}
      </div>

      <p className="m-0 text-center text-[11px] text-text-muted">
        {hu.inspector.describeFootnote}
      </p>
    </div>
  );
}

function ChannelRow({
  channel,
  selectionText,
  isLast,
}: Readonly<{ channel: Channel; selectionText: string; isLast: boolean }>) {
  const params = useParams<{ bookId?: string; sceneId?: string }>();
  const bookId = params?.bookId;
  const sceneId = params?.sceneId;

  const [open, setOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<string[] | null>(null);

  const describeMutation = useDescribe();
  const projectIdQuery = useBookProjectId(bookId);
  const snippetMutation = useCreateSnippet();
  const motionConf = useCalmMotion();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Generate on first open (only if we have a selection + no result yet).
    if (next && alternatives === null && selectionText.trim().length > 0) {
      describeMutation.mutate(
        {
          selected_text: selectionText,
          channels: [channel.id],
          scene_id: sceneId ?? null,
        },
        {
          onSuccess: (res) =>
            setAlternatives(res.revisions.map((r) => r.content)),
          // Error surfaces via describeMutation.isError (never swallowed).
        },
      );
    }
  };

  const saveSnippet = (content: string) => {
    const projectId = projectIdQuery.data;
    if (!projectId) {
      toast(projectIdQuery.error?.message ?? hu.projects.openProjectError);
      return;
    }
    snippetMutation.mutate(
      {
        projectId,
        data: {
          title: channel.label,
          content,
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
    <div className={cn(!isLast && "border-b border-border")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-11 w-full items-center gap-2.5 bg-surface px-3 text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-text hover:bg-surface-muted"
      >
        <Icon icon={channel.icon} size={16} className="text-accent" />
        <span className="flex-1">{channel.label}</span>
        <Icon
          icon={ChevronRight}
          size={13}
          className={cn("transition-transform", open && "rotate-90")}
        />
      </button>

      {/* AnimatePresence wraps the expanded content so each channel's
          alternatives reveal in a calm staggered sequence (and tidy up on
          collapse). Reduced motion → the no-op variants render instantly. */}
      <AnimatePresence initial={false}>
        {open ? (
          <div className="flex flex-col gap-3 border-t border-ai/20 bg-ai-muted px-3 py-3">
            {describeMutation.isPending ? (
              <div className="flex items-center gap-2">
                <Spinner size={13} />
                <span className="text-[12px] text-text-muted">
                  {hu.inspector.channelGenerating}
                </span>
              </div>
            ) : null}

            {describeMutation.isError ? (
              <p className="m-0 text-[12px] text-danger-text" role="alert">
                {hu.inspector.channelError}: {describeMutation.error.message}
              </p>
            ) : null}

            {alternatives ? (
              <motion.div
                className="flex flex-col gap-3"
                variants={motionConf.staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {alternatives.map((text) => (
                  <motion.div key={text} variants={motionConf.staggerChild}>
                    <p className="m-0 mb-1.5 font-serif text-[13px] leading-[1.6] text-text-soft">
                      {text}
                    </p>
                    <button
                      type="button"
                      onClick={() => saveSnippet(text)}
                      className="flex h-6 items-center gap-1.5 rounded-md bg-transparent px-2 text-[11px] text-text-muted hover:bg-surface hover:text-accent-text"
                    >
                      <Icon icon={Star} size={11} />
                      {hu.inspector.saveSnippet}
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            ) : null}
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
