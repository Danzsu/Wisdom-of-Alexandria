"use client";

import { CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

/**
 * App toaster (mount once near the root). Styles sonner toasts to match the
 * prototype: surface bg, border + a 3px left accent-edge keyed by type, 10px
 * radius, popover shadow, 13px text, a leading type icon and the
 * `woaToastSpring` entrance — a 14px rise with a SUBTLE spring overshoot
 * (.34s var(--ease-spring), MOTION pass). Positioned bottom-right.
 * Reduced-motion safe via the global prefers-reduced-motion block.
 *
 * The per-type left edge is applied via the `classNames.{success,info,warning,
 * error}` slots; the shared shell via `classNames.toast`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      duration={3000}
      icons={{
        success: <CheckCircle2 size={15} className="text-success" aria-hidden="true" />,
        info: <Info size={15} className="text-ai" aria-hidden="true" />,
        warning: (
          <AlertTriangle size={15} className="text-warning" aria-hidden="true" />
        ),
        error: <XCircle size={15} className="text-danger" aria-hidden="true" />,
      }}
      toastOptions={{
        // The shell: surface card, default (info-ish) accent edge, spring-in
        // entrance (subtle overshoot; no fill mode so sonner's stacking
        // transform takes over once the entrance finishes). Type variants
        // below override the left border colour.
        classNames: {
          toast:
            "!flex !items-center !gap-2 !rounded-[10px] !border !border-border " +
            "!border-l-[3px] !bg-surface !px-3.5 !py-2.5 !text-body !text-text " +
            "!shadow-popover [animation:woaToastSpring_.34s_var(--ease-spring)] " +
            "!font-sans",
          title: "!text-body !font-medium !text-text",
          description: "!text-small !text-text-muted",
          icon: "!m-0 !flex !items-center",
          success: "!border-l-success",
          info: "!border-l-ai",
          warning: "!border-l-warning",
          error: "!border-l-danger",
        },
      }}
    />
  );
}

/**
 * Typed toast helper re-export. Use `toast.success(...)`, `toast.info(...)`,
 * `toast.warning(...)`, `toast.error(...)` or `toast(...)` for a default toast.
 * Replaces the prototype's setTimeout toast.
 */
export const toast = sonnerToast;
