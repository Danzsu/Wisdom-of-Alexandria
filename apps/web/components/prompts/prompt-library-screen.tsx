"use client";

import { useState } from "react";
import {
  Brain,
  CheckCircle,
  Eye,
  Plus,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Icon,
  Modal,
  ModalBody,
  ModalHeader,
  ModalShell,
  PageHero,
  toast,
} from "@/components/kit";
import { hu } from "@/lib/i18n/hu";
import {
  PROMPT_LIBRARY,
  type PromptTemplate,
} from "@/lib/prompt-library-data";

/** Maps a serializable `iconKey` from the data file to a lucide icon. */
const PROMPT_ICONS: Record<PromptTemplate["iconKey"], LucideIcon> = {
  sparkles: Sparkles,
  refresh: RefreshCw,
  eye: Eye,
  brain: Brain,
  check: CheckCircle,
};

/**
 * Prompt Library (`konyv/[bookId]/promptok`) — the AI prompt catalogue.
 *
 * Faithful to the Claude Design canvas: an accent-muted radial top wash, a
 * gold-eyebrow header with an "Új prompt" action, and a two-column grid of
 * hover-lift prompt cards. Each card opens a read-only detail modal showing the
 * full example template body. The seed prompts live in
 * `@/lib/prompt-library-data`; creating prompts is an honest stub (toast) until
 * a prompts backend exists.
 */
export function PromptLibraryScreen() {
  const [selected, setSelected] = useState<PromptTemplate | null>(null);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(120%_50%_at_50%_-12%,var(--accent-muted)_0%,transparent_46%)] px-10 pb-20 pt-11">
      <div className="mx-auto max-w-[900px]">
        {/* Header — shared PageHero (gold-rule eyebrow + display title + italic
            subtitle) with the accent "Új prompt" action in its right slot. */}
        <PageHero
          className="mb-[26px]"
          eyebrow={hu.promptLibrary.eyebrow}
          title={hu.promptLibrary.title}
          subtitle={hu.promptLibrary.subtitle}
          action={
            <Button
              variant="cta"
              size={40}
              className="h-[38px]"
              leadingIcon={<Icon icon={Plus} size={15} />}
              onClick={() => toast.info(hu.promptLibrary.createSoon)}
            >
              {hu.promptLibrary.newPrompt}
            </Button>
          }
        />

        {/* Grid: two columns (one on mobile). */}
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
          {PROMPT_LIBRARY.map((prompt) => {
            const PromptIcon = PROMPT_ICONS[prompt.iconKey];
            return (
              <button
                key={prompt.id}
                type="button"
                onClick={() => setSelected(prompt)}
                className="woa-card-aura block cursor-pointer rounded-[14px] border border-border bg-surface p-[18px] text-left shadow-card hover:-translate-y-1"
              >
                <span className="mb-[11px] flex items-center gap-[11px]">
                  <span className="inline-flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-ai-muted text-ai-text">
                    <Icon icon={PromptIcon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[19px] font-semibold text-text">
                      {prompt.name}
                    </span>
                  </span>
                  <span className="rounded-full bg-surface-muted px-[9px] py-0.5 text-[10.5px] font-semibold text-text-muted">
                    {prompt.cat}
                  </span>
                </span>
                <span className="block text-[13px] leading-[1.55] text-text-muted [text-wrap:pretty]">
                  {prompt.desc}
                </span>
                <span className="mt-3 flex items-center gap-1.5 text-[11.5px] text-text-faint">
                  <Icon icon={Sparkles} size={12} aria-hidden />
                  {hu.promptLibrary.usesLabel(prompt.uses)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Read-only detail modal — reuses the kit Modal (Esc / backdrop / close +
          focus trap all handled by Radix). */}
      <Modal
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected ? (
          <ModalShell maxWidth={560}>
            <ModalHeader
              title={selected.name}
              leadingIcon={
                <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-ai-muted text-ai-text">
                  <Icon icon={PROMPT_ICONS[selected.iconKey]} size={17} />
                </span>
              }
              closeLabel={hu.promptLibrary.modalClose}
            />
            <ModalBody className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-surface-muted px-[9px] py-0.5 text-[10.5px] font-semibold text-text-muted">
                  {selected.cat}
                </span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-text-faint">
                  <Icon icon={Sparkles} size={12} aria-hidden />
                  {hu.promptLibrary.usesLabel(selected.uses)}
                </span>
              </div>

              <div>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-text-faint">
                  {hu.promptLibrary.modalDescription}
                </h3>
                <p className="m-0 text-[13.5px] leading-[1.55] text-text-soft [text-wrap:pretty]">
                  {selected.desc}
                </p>
              </div>

              <div>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-text-faint">
                  {hu.promptLibrary.modalTemplate}
                </h3>
                <pre className="m-0 whitespace-pre-wrap rounded-[12px] border border-border bg-surface-soft p-3.5 font-serif text-[13.5px] leading-[1.6] text-text">
                  {selected.template}
                </pre>
              </div>
            </ModalBody>
          </ModalShell>
        ) : null}
      </Modal>
    </div>
  );
}
