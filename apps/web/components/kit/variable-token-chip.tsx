import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variableTokenChipVariants = cva(
  "inline-flex items-center font-mono text-xs",
  {
    variants: {
      variant: {
        required: "bg-ai-muted text-ai-text",
        optional: "bg-surface-muted text-text-muted",
      },
      inline: {
        // Inline placeholder inside running text.
        true: "rounded-md px-[7px] py-0.5",
        // Standalone 24px-tall chip.
        false: "h-6 rounded-[7px] px-2.5",
      },
    },
    defaultVariants: {
      variant: "required",
      inline: false,
    },
  },
);

export interface VariableTokenChipProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof variableTokenChipVariants> {}

/**
 * Monospace chip for `{{beat}}`-style prompt placeholders. `required` uses the
 * AI tint, `optional` the muted surface. `inline` shrinks it to flow inside a
 * line of text.
 */
export const VariableTokenChip = forwardRef<
  HTMLSpanElement,
  VariableTokenChipProps
>(function VariableTokenChip({ className, variant, inline, ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cn(variableTokenChipVariants({ variant, inline }), className)}
      {...props}
    />
  );
});
