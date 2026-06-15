"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";

/**
 * Tracks whether something inside the shell already rendered the single Radix
 * `Dialog.Title` (the `title` prop or a `ModalHeader`). The fallback consumer
 * reads `titledRef` to decide whether to emit a visually-hidden title — so the
 * dialog always has an accessible name and we never render two `Dialog.Title`
 * nodes (which would collide on the same Radix-assigned id).
 */
const ModalTitleContext = createContext<{
  titledRef: RefObject<boolean>;
} | null>(null);

/** Called by `ModalHeader` during render to register that it owns the title. */
export function useMarkModalTitled() {
  const ctx = useContext(ModalTitleContext);
  if (ctx) ctx.titledRef.current = true;
}

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
  /**
   * Accessible title rendered as a visually-hidden `Dialog.Title` when no
   * visible `ModalHeader` is used. Omit it when a `ModalHeader` supplies the
   * title; if neither is present a generic hidden fallback keeps the dialog
   * from ever being nameless.
   */
  title?: string;
  /** Optional visually-hidden description for assistive tech. */
  description?: string;
  /** Content class override. */
  className?: string;
}

/**
 * Visually-hidden last-resort `Dialog.Title`. Rendered AFTER the shell's
 * children, it reads the title ref (synchronously mutated during the render of
 * the `title` prop's title or a `ModalHeader`) at its OWN render time and emits a
 * generic sr-only title only when nothing else did — so a dialog can never be
 * nameless, and we never render two `Dialog.Title` nodes.
 */
function ModalTitleFallback() {
  const ctx = useContext(ModalTitleContext);
  if (ctx?.titledRef.current) return null;
  return (
    <DialogPrimitive.Title className="sr-only">
      {hu.modal.untitledFallback}
    </DialogPrimitive.Title>
  );
}

/**
 * Centred modal surface (portalled). Overlay is a translucent scrim with a
 * `woaFade` entrance; content is a surface card (14–16px radius, popover shadow)
 * with a `woaReveal` entrance. Always renders exactly one `Dialog.Title` for
 * a11y: the `title` prop renders a visually-hidden title, a `ModalHeader`
 * renders the visible one, and if a caller supplies neither a generic
 * visually-hidden fallback is emitted so the dialog is never nameless.
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
  // Mutated synchronously during the render of any Title source below; the
  // trailing <ModalTitleFallback> (rendered last) reads it to decide whether to
  // emit the generic fallback. A ref written during a child's render is visible
  // to a later sibling's render, which is exactly the order we rely on here.
  const titledRef = useRef(false);
  titledRef.current = Boolean(title);
  const ctxValue = useRef({ titledRef }).current;

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
          style={{ maxWidth, ...style }}
          className={cn(
            "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-popover",
            "[animation:woaReveal_.18s_cubic-bezier(.22,1,.36,1)]",
            className,
          )}
          {...props}
        >
          <ModalTitleContext.Provider value={ctxValue}>
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
            <ModalTitleFallback />
          </ModalTitleContext.Provider>
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
}: Readonly<ModalHeaderProps>) {
  // Register that this header owns the dialog's single Dialog.Title so the
  // shell's last-resort fallback title is suppressed.
  useMarkModalTitled();
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
