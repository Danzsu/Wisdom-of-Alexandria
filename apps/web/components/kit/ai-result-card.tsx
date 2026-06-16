"use client";

import type { ReactNode } from "react";
import { Check, Copy, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { Button } from "./button";
import { BrandStar } from "./brand-star";
import { SectionEyebrow } from "./section-eyebrow";
import { ContextChips, type ContextEntity } from "./context-chips";

export interface AIResultCardProps {
  /** Action label, e.g. "Átírás" — rendered as "{label} eredménye". */
  label: string;
  /** Prompt version badge text, e.g. "v1.2". */
  version?: string;
  /** Context entities that fed the generation (reuses ContextChips). */
  contextEntities?: ContextEntity[];
  /** Model name chip. */
  model?: string;
  /** Generated body text (rendered in Literata 14/1.65). */
  body: ReactNode;
  /** Accept handler ("Elfogad"). */
  onAccept?: () => void;
  /** Reject handler ("Elvet"). */
  onReject?: () => void;
  /** Copy handler. */
  onCopy?: () => void;
  /** Save-as-Snippet (star) handler. */
  onStar?: () => void;
  /**
   * Disable the Accept (Elfogad) + Star actions — used while an approve POST is
   * in flight so a double-click can't fire two approves / two inserts.
   */
  busy?: boolean;
  /** Disclaimer line override. */
  disclaimer?: string;
  className?: string;
}

/**
 * Presentational AI result card — the human-in-the-loop contract surface. A full
 * AI treatment (soft `bg-ai-muted` tint + a `ring-ai/20` ring, no side-stripe),
 * a faint top gradient bar (accent→ai), a BrandStar sparkle + "{label} eredménye"
 * eyebrow + version badge, the context chip row, the generated body in Literata,
 * and an Elfogad / Elvet + Copy / Star footer. The AI identity reads from the
 * full-card tint + the leading sparkle, not a left bar. Holds no AI logic; all
 * actions are caller callbacks. The disclaimer states that the AI never writes
 * to the manuscript without approval.
 */
export function AIResultCard({
  label,
  version,
  contextEntities = [],
  model,
  body,
  onAccept,
  onReject,
  onCopy,
  onStar,
  busy = false,
  disclaimer = "Az AI sosem ír a kéziratba jóváhagyás nélkül.",
  className,
}: AIResultCardProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-ai/20 bg-ai-muted shadow-card ring-1 ring-ai/20",
          "[animation:woaReveal_.25s_cubic-bezier(.22,1,.36,1)]",
          className,
        )}
      >
        {/* 2px accent→ai gradient bar (documented hardcoded gradient). */}
        <div
          className="h-0.5 opacity-65"
          style={{
            background: "linear-gradient(90deg,var(--accent),var(--ai))",
          }}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-2.5 p-3.5">
          <div className="flex items-center gap-1.5">
            <BrandStar
              size={14}
              variant="sparkle"
              // ~3 twinkle iterations on reveal.
              style={{ animation: "woaTwinkle 1.6s ease-in-out 3" }}
            />
            <SectionEyebrow className="flex-1">
              {label} eredménye
            </SectionEyebrow>
            {version ? (
              // Plain version pill (no leading dot) — matches the prototype.
              <span className="flex h-[18px] items-center rounded-full bg-ai-muted px-[7px] text-[10px] font-semibold text-ai-text">
                {version}
              </span>
            ) : null}
          </div>

          {contextEntities.length > 0 || model ? (
            <ContextChips entities={contextEntities} model={model} />
          ) : null}

          <p className="m-0 font-serif text-[14px] leading-[1.65] text-text-soft [text-wrap:pretty]">
            {body}
          </p>

          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              variant="success"
              size={32}
              leadingIcon={<Icon icon={Check} size={13} />}
              onClick={onAccept}
              disabled={busy}
            >
              Elfogad
            </Button>
            <Button
              variant="secondary"
              size={32}
              leadingIcon={<Icon icon={X} size={13} />}
              onClick={onReject}
            >
              Elvet
            </Button>
            <div className="flex-1" />
            <IconButton size={30} aria-label={hu.kit.copy} onClick={onCopy}>
              <Icon icon={Copy} size={14} />
            </IconButton>
            <IconButton
              size={30}
              variant="ai"
              aria-label={hu.kit.saveAsSnippet}
              onClick={onStar}
              disabled={busy}
            >
              <Icon icon={Star} size={14} />
            </IconButton>
          </div>
        </div>
      </div>
      <p className="m-0 text-center text-[11px] text-text-muted">{disclaimer}</p>
    </div>
  );
}
