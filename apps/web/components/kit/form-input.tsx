import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FormInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  /**
   * Error state. `true` shows the danger border + sets `aria-invalid`; a string
   * also renders a `role="alert"` message below the field, wired via
   * `aria-describedby`.
   */
  error?: boolean | string;
  /** Wrapper class (the field + optional message live in one column). */
  wrapperClassName?: string;
  /**
   * Non-interactive adornment rendered to the LEFT of the input (e.g. a
   * currency symbol, a unit label, or a small icon). When present the
   * border + focus-ring move to the flex wrapper so the adornment appears
   * inside the visible field boundary.
   */
  prefix?: ReactNode;
  /**
   * Non-interactive adornment rendered to the RIGHT of the input. Same
   * layout rules as `prefix`.
   */
  suffix?: ReactNode;
}

/**
 * Single-line text field. 36px tall, 12px horizontal padding, 1px border, 8px
 * radius, 14px text. Keyboard focus shows the accent border + a 3px
 * accent-muted ring. When `error` is set the border turns danger, `aria-invalid`
 * is applied, and a string error renders an accessible alert below.
 *
 * `prefix`/`suffix` render non-interactive adornments inside the visible field
 * boundary. When either is present the border + focus-ring move to the flex
 * wrapper so they appear as part of the field.
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput(
    {
      className,
      wrapperClassName,
      error,
      type,
      id,
      "aria-describedby": ariaDescribedBy,
      prefix,
      suffix,
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

    const hasSlots = Boolean(prefix ?? suffix);

    // When adornment slots are present the border/ring live on the wrapper;
    // the input itself is borderless and fills the remaining flex space.
    const inputSlottedClasses = "min-w-0 flex-1 h-9 px-0";
    const inputStandaloneClasses = cn(
      "box-border h-9 w-full rounded-lg border bg-surface px-3",
      "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]",
      hasError ? "border-danger" : "border-border",
    );

    const inputEl = (
      <input
        ref={ref}
        id={id}
        type={type ?? "text"}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={cn(
          "font-sans text-field text-text outline-none bg-transparent",
          "placeholder:text-text-faint",
          "disabled:cursor-not-allowed disabled:opacity-50",
          hasSlots ? inputSlottedClasses : inputStandaloneClasses,
          className,
        )}
        {...props}
      />
    );

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {hasSlots ? (
          <div
            className={cn(
              "flex items-center box-border h-9 rounded-lg border bg-surface",
              "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-muted)]",
              hasError ? "border-danger" : "border-border",
            )}
          >
            {prefix ? (
              <span
                aria-hidden="true"
                className="shrink-0 px-2 text-sm text-text-muted select-none"
              >
                {prefix}
              </span>
            ) : null}
            {inputEl}
            {suffix ? (
              <span
                aria-hidden="true"
                className="shrink-0 px-2 text-sm text-text-muted select-none"
              >
                {suffix}
              </span>
            ) : null}
          </div>
        ) : (
          inputEl
        )}
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
