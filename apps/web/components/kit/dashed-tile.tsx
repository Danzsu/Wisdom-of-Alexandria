import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const dashedTileVariants = cva(
  // Dashed strong border, centred column, muted text; hover -> accent affordance.
  "flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border-strong font-sans text-text-muted transition-colors " +
    "hover:border-accent hover:bg-accent-muted hover:text-accent-text " +
    "disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        // Add-a-card tile (project dashboard / board).
        add: "min-h-[170px] w-full rounded-[14px] bg-transparent text-[13px]",
        // Import dropzone.
        import:
          "min-h-[150px] w-full rounded-[14px] bg-surface-soft text-[12px] text-text-muted",
        // Inline image placeholder dropzone.
        image:
          "min-h-[160px] w-full rounded-xl bg-surface-muted text-[12px] text-text-muted",
        // Square portrait upload.
        portrait:
          "h-[84px] w-[84px] gap-[3px] rounded-xl bg-surface-muted text-[10px] text-text-muted",
        // Book-cover upload.
        cover:
          "h-[106px] w-[76px] gap-[5px] rounded-[10px] bg-surface-muted text-[10px] text-text-muted",
      },
    },
    defaultVariants: {
      size: "add",
    },
  },
);

export interface DashedTileProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    VariantProps<typeof dashedTileVariants> {
  /** Leading icon node. */
  icon?: ReactNode;
  /** Primary label. */
  label?: ReactNode;
  /** Secondary hint line. */
  hint?: ReactNode;
}

/**
 * Pure-visual dashed tile / dropzone. Five size presets (add / import / image /
 * portrait / cover). Hover shows the accent affordance. This is a visual
 * placeholder only — real upload wiring lands later. Provide an `aria-label`
 * when there is no visible `label`.
 */
export const DashedTile = forwardRef<HTMLButtonElement, DashedTileProps>(
  function DashedTile({ className, size, icon, label, hint, type, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(dashedTileVariants({ size }), className)}
        {...props}
      >
        {icon}
        {label ? <span className="font-semibold">{label}</span> : null}
        {hint ? <span className="text-text-muted">{hint}</span> : null}
      </button>
    );
  },
);

export { dashedTileVariants };
