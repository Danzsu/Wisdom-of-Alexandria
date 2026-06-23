import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FormInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /**
   * Error state. `true` shows the danger border + sets `aria-invalid`; a string
   * also renders a `role="alert"` message below the field, wired via
   * `aria-describedby`.
   */
  error?: boolean | string;
  /** Wrapper class (the field + optional message live in one column). */
  wrapperClassName?: string;
}

/**
 * Single-line text field. 36px tall, 12px horizontal padding, 1px border, 8px
 * radius, 14px text. Keyboard focus shows the accent border + a 3px
 * accent-muted ring. When `error` is set the border turns danger, `aria-invalid`
 * is applied, and a string error renders an accessible alert below.
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput(
    { className, wrapperClassName, error, type, id, "aria-describedby": ariaDescribedBy, ...props },
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
        <input
          ref={ref}
          id={id}
          type={type ?? "text"}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cn(
            "box-border h-9 w-full rounded-lg border bg-surface px-3 font-sans text-field text-text outline-none",
            "placeholder:text-text-faint",
            "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
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

/** Shared field-label helper used by forms (12px/600). Re-exported for screens. */
export function FieldLabel({
  htmlFor,
  children,
  className,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  /** Optional trailing node (e.g. an AI sparkle glyph). */
  hint?: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1 flex items-center gap-1.5 text-small font-semibold text-text",
        className,
      )}
    >
      {children}
      {hint}
    </label>
  );
}
