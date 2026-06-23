"use client";

import type { ReactNode } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { Icon } from "./icon";
import { Button } from "./button";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export interface ConfirmDialogProps {
  /** Controlled open state. */
  open?: boolean;
  /** Open-state change handler. */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title. */
  title: ReactNode;
  /** Body / description text. */
  description: ReactNode;
  /** Confirm button label. */
  confirmLabel?: string;
  /** Cancel button label. */
  cancelLabel?: string;
  /** Fired when the destructive action is confirmed. */
  onConfirm?: () => void;
  /** Fired when cancelled (optional). */
  onCancel?: () => void;
  /** Trigger element (omit when driving `open` externally). */
  trigger?: ReactNode;
  /** Leading icon node (defaults to a danger AlertTriangle). */
  leadingIcon?: ReactNode;
  /** Scrim strength (destructive confirms use the strong scrim by default). */
  scrim?: "default" | "strong" | "soft";
}

const SCRIM: Record<NonNullable<ConfirmDialogProps["scrim"]>, string> = {
  default: "bg-[rgba(24,18,9,.45)]",
  strong: "bg-[rgba(24,18,9,.5)]",
  soft: "bg-[rgba(24,18,9,.4)]",
};

/**
 * Destructive-confirmation dialog on Radix `AlertDialog`. Renders a danger icon,
 * title, description and Mégse (cancel) / destructive confirm buttons. Radix
 * supplies the `alertdialog` role and focus trapping; `onConfirm` fires only on
 * the confirm action, `onCancel` on the cancel action.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = hu.kit.confirmDelete,
  cancelLabel = hu.kit.cancel,
  onConfirm,
  onCancel,
  trigger,
  leadingIcon,
  scrim = "strong",
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <AlertDialogPrimitive.Trigger asChild>
          {trigger}
        </AlertDialogPrimitive.Trigger>
      ) : null}
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[53] flex items-center justify-center p-6 [animation:woaFade_.16s_ease-out]",
            SCRIM[scrim],
          )}
        >
          <AlertDialogPrimitive.Content
            className={cn(
              "w-full max-w-[400px] overflow-hidden rounded-[16px] border border-border bg-surface shadow-popover",
              "[animation:woaReveal_.18s_cubic-bezier(.22,1,.36,1)]",
            )}
          >
            <div className="flex gap-[13px] px-5 pt-5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-danger-muted text-danger-text">
                {leadingIcon ?? <Icon icon={AlertTriangle} size={20} />}
              </span>
              <div className="flex-1">
                <AlertDialogPrimitive.Title className="mb-1 text-[16px] font-semibold text-text">
                  {title}
                </AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="text-body leading-[1.5] text-text-soft">
                  {description}
                </AlertDialogPrimitive.Description>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-[18px]">
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="secondary" size={34} onClick={() => onCancel?.()}>
                  {cancelLabel}
                </Button>
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action asChild>
                <Button
                  variant="destructive"
                  size={34}
                  onClick={() => onConfirm?.()}
                >
                  {confirmLabel}
                </Button>
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Overlay>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
