"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { useUIStore, type ShellDrawerId } from "@/lib/stores/ui-store";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

/**
 * True when the user prefers reduced motion. Read at call time (not cached) so
 * the gate is fresh each render. SSR / jsdom-safe: returns `false` when
 * `matchMedia` is unavailable, so the default keeps the (transform-only) slide.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface ShellDrawerProps {
  /** Which store drawer this instance owns (`tree` = left, `inspector` = right). */
  id: ShellDrawerId;
  /** Side the drawer slides in from. */
  side: "left" | "right";
  /** Accessible name for the drawer dialog. */
  label: string;
  /** Drawer body (the pane that is inline on desktop). */
  children: ReactNode;
  /** Width utility class for the panel (e.g. `w-tree`, `w-inspector`). */
  widthClass: string;
}

/**
 * Responsive shell drawer (UX-4a). Below the `lg` breakpoint the left structure
 * pane (chapter tree / codex) and the right AI inspector are not inline — they
 * become slide-in overlays driven by the shared UI store (`shellDrawer`, single
 * open at a time). Built on Radix Dialog so it is modal, focus-trapped, labelled
 * and Esc-closable for free; focus moves into the drawer on open and returns to
 * the trigger on close (Radix default).
 *
 * Motion is transform-only (slide from the edge) and reduced-motion-aware: under
 * `prefers-reduced-motion` the panel appears instantly (no transition). The
 * panel is rendered into a portal so it overlays the full-width content; the
 * scrim closes it on click (Radix overlay → onOpenChange(false)).
 *
 * This component is always mounted, but the store value only ever becomes
 * non-null below `lg` (the toggles that set it are CSS-hidden on desktop), so on
 * desktop the dialog stays closed and the inline pane (rendered separately by
 * the shell) is what shows — keeping the desktop layout, and jsdom tests, intact.
 */
export function ShellDrawer({
  id,
  side,
  label,
  children,
  widthClass,
}: ShellDrawerProps) {
  const open = useUIStore((s) => s.shellDrawer === id);
  const close = useUIStore((s) => s.closeShellDrawer);

  // Resolve reduced-motion once per open so the slide can be skipped without a
  // layout read on every render.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (open) setReduced(prefersReducedMotion());
  }, [open]);

  const isLeft = side === "left";
  // Transform-only slide, picked by side; skipped entirely under reduced motion
  // (the panel then simply appears in place — no transition).
  let slideClass: string | undefined;
  if (!reduced) {
    slideClass = isLeft
      ? "[animation:woaSlideInLeft_.2s_cubic-bezier(.22,1,.36,1)]"
      : "[animation:woaSlideInRight_.2s_cubic-bezier(.22,1,.36,1)]";
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[55] bg-[rgba(24,18,9,.4)]",
            reduced ? undefined : "[animation:woaFade_.16s_ease-out]",
          )}
        />
        <Dialog.Content
          id={`shell-drawer-${id}`}
          aria-label={label}
          className={cn(
            "fixed inset-y-0 z-[56] flex max-w-[86vw] flex-col bg-surface shadow-popover",
            widthClass,
            isLeft
              ? "left-0 border-r border-border"
              : "right-0 border-l border-border",
            slideClass,
          )}
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <Dialog.Description className="sr-only">{label}</Dialog.Description>

          {/* Compact close affordance (the scrim + Esc also close it). */}
          <div className="flex flex-none items-center justify-end border-b border-border px-2 py-1.5">
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={hu.shell.closeDrawerAria}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
              >
                <Icon icon={X} size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
