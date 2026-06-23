import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva(
  // Shared: full width, 1px border, 10px radius, focus ring, resize handling.
  "box-border w-full rounded-[10px] border bg-surface px-3 py-[10px] text-text outline-none placeholder:text-text-faint focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // UI sans, 13px / 1.5 — the default custom-instruction / note field.
        default: "font-sans text-body leading-[1.5]",
        // Literata serif, 14px / 1.6 — manuscript-flavoured description fields.
        manuscript: "font-serif text-field leading-[1.6]",
        // ui-monospace, 12px / 1.6 — outline / code paste field.
        mono: "font-mono text-small leading-[1.6]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  /** Error state — danger border + `aria-invalid` + optional alert message. */
  error?: boolean | string;
  /** Minimum height in px (sets `min-height` style). */
  minHeight?: number;
  /** Wrapper class for the column (field + optional message). */
  wrapperClassName?: string;
}

/**
 * Multi-line text field. Three typographic variants: `default` (UI sans),
 * `manuscript` (Literata serif 14/1.6) and `mono` (ui-monospace). Same border,
 * radius and focus ring as `FormInput`. `minHeight` sets an auto minimum.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      className,
      wrapperClassName,
      variant,
      error,
      minHeight,
      style,
      id,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) {
    const hasError = Boolean(error);
    const messageText = typeof error === "string" ? error : undefined;
    const generatedId = useId();
    const messageId = messageText ? `${id ?? generatedId}-error` : undefined;
    const describedBy =
      [ariaDescribedBy, messageId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        <textarea
          ref={ref}
          id={id}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          style={minHeight ? { minHeight, ...style } : style}
          className={cn(
            textareaVariants({ variant }),
            hasError ? "border-danger" : "border-border",
            className,
          )}
          {...props}
        />
        {messageText ? (
          <span id={messageId} role="alert" className="text-small text-danger-text">
            {messageText}
          </span>
        ) : null}
      </div>
    );
  },
);

export { textareaVariants };
