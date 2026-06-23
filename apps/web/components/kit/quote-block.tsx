import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type QuoteBlockProps = HTMLAttributes<HTMLQuoteElement>;

/**
 * Pull-quote / excerpt block: muted surface, 2px accent left border, Literata
 * italic at 13px. Used for inline manuscript excerpts and quoted context.
 */
export const QuoteBlock = forwardRef<HTMLQuoteElement, QuoteBlockProps>(
  function QuoteBlock({ className, children, ...props }, ref) {
    return (
      <blockquote
        ref={ref}
        className={cn(
          "border-l-2 border-accent bg-surface-muted px-3 py-2.5 font-serif text-body italic leading-[1.6] text-text-soft",
          "rounded-r-[10px] rounded-l-none",
          className,
        )}
        {...props}
      >
        {children}
      </blockquote>
    );
  },
);
