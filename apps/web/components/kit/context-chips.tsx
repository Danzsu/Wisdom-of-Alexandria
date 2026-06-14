import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ContextEntity {
  /** Visible label, e.g. a character or location name. */
  label: string;
  /** Leading 11px icon (e.g. an `<Icon icon={User} size={11} />`). */
  icon?: ReactNode;
}

export interface ContextChipsProps {
  /** Entity chips (character / location / etc.). */
  entities: ContextEntity[];
  /** Optional model chip (AI-tinted) shown after the entities. */
  model?: string;
  /** Override the leading label text. */
  label?: string;
  className?: string;
}

/**
 * "Kontextus:" label followed by a row of entity chips (muted surface) and an
 * optional AI-tinted model chip. Used on AI result cards to show what context
 * fed a generation.
 */
export function ContextChips({
  entities,
  model,
  label = "Kontextus:",
  className,
}: ContextChipsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-[11px] font-semibold text-text-muted">{label}</span>
      {entities.map((entity) => (
        <span
          key={entity.label}
          className="inline-flex h-5 items-center gap-1 rounded-full bg-surface-muted px-2 text-[11px] font-medium text-text-soft"
        >
          {entity.icon}
          {entity.label}
        </span>
      ))}
      {model ? (
        <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-ai-muted px-2 text-[11px] font-semibold text-ai-text">
          {model}
        </span>
      ) : null}
    </div>
  );
}
