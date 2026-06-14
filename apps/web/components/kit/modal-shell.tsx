"use client";

import { forwardRef } from "react";
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";

/* ============================================================================
   ModalShell — a centred dialog on Radix Dialog. Composed as:
     <ModalShell open onOpenChange={…} title="…">
       <ModalHeader title="…" leadingIcon={…} />
       …body…
       <ModalFooter>…</ModalFooter>
     </ModalShell>
   ========================================================================== */

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalTitle = DialogPrimitive.Title;
export const ModalDescription = DialogPrimitive.Description;

/** Overlay scrim strengths matching the prototype (default .45 / strong .5 / soft .4). */
const SCRIM: Record<NonNullable<ModalShellProps["scrim"]>, string> = {
  default: "bg-[rgba(24,18,9,.45)]",
  strong: "bg-[rgba(24,18,9,.5)]",
  soft: "bg-[rgba(24,18,9,.4)]",
};

export interface ModalShellProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Scrim strength. */
  scrim?: "default" | "strong" | "soft";
  /** Max width in px. */
  maxWidth?: number;
  /** Accessible title — required; renders a visually-hidden `Dialog.Title` when no visible header is used. */
  title?: string;
  /** Optional visually-hidden description for assistive tech. */
  description?: string;
  /** Content class override. */
  className?: string;
}

/**
 * Centred modal surface (portalled). Overlay is a translucent scrim with a
 * `woaFade` entrance; content is a surface card (14–16px radius, popover shadow)
 * with a `woaReveal` entrance. Always renders a `Dialog.Title` for a11y — pass a
 * visible `ModalHeader` (which supplies its own title) and the `title` prop is
 * used only as the visually-hidden fallback when no header title is present.
 */
export const ModalShell = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  ModalShellProps
>(function ModalShell(
  {
    scrim = "default",
    maxWidth = 540,
    title,
    description,
    className,
    children,
    style,
    ...props
  },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center p-6 [animation:woaFade_.16s_ease-out]",
          SCRIM[scrim],
        )}
      >
        <DialogPrimitive.Content
          ref={ref}
          aria-label={title}
          style={{ maxWidth, ...style }}
          className={cn(
            "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-popover",
            "[animation:woaReveal_.18s_cubic-bezier(.22,1,.36,1)]",
            className,
          )}
          {...props}
        >
          {/* Always provide a Title node so Radix's a11y requirement is met. If
              a visible ModalHeader is rendered it supplies the real title and
              this hidden one is omitted by the caller passing `title=""`. */}
          {title ? (
            <DialogPrimitive.Title className="sr-only">
              {title}
            </DialogPrimitive.Title>
          ) : null}
          {description ? (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
});

export interface ModalHeaderProps {
  /** Visible title — rendered as the Radix `Dialog.Title`. */
  title: ReactNode;
  /** Leading accent/ai icon slot. */
  leadingIcon?: ReactNode;
  /** Optional leading control (e.g. a back button) before the icon/title. */
  leading?: ReactNode;
  /** Hide the close X (rarely). */
  hideClose?: boolean;
  /** Accessible label for the close button. */
  closeLabel?: string;
  className?: string;
}

/**
 * Modal header row: optional leading control + icon slot, the `Dialog.Title`
 * (16–17px/600, flex-1) and a 30px close X (`Dialog.Close`). Bottom border.
 */
export function ModalHeader({
  title,
  leadingIcon,
  leading,
  hideClose = false,
  closeLabel = "Bezárás",
  className,
}: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-none items-center gap-2.5 border-b border-border px-5 py-4",
        className,
      )}
    >
      {leading}
      {leadingIcon}
      <DialogPrimitive.Title className="flex-1 text-[17px] font-semibold text-text">
        {title}
      </DialogPrimitive.Title>
      {!hideClose ? <ModalClose label={closeLabel} /> : null}
    </div>
  );
}

export interface ModalCloseProps {
  /** Accessible label. */
  label?: string;
  className?: string;
}

/** 30px close button wired to `Dialog.Close`. */
export function ModalClose({ label = "Bezárás", className }: ModalCloseProps) {
  return (
    <DialogPrimitive.Close asChild>
      <IconButton size={30} aria-label={label} className={className}>
        <Icon icon={X} size={15} />
      </IconButton>
    </DialogPrimitive.Close>
  );
}

/** Right-aligned footer with a top border. */
export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-end gap-2 border-t border-border px-5 py-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Scrollable body region for modal content. */
export function ModalBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-[18px]", className)}>
      {children}
    </div>
  );
}
