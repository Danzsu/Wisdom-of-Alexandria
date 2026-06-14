/**
 * A small token swatch driven entirely by Tailwind token utility classes
 * (e.g. `bg-accent`, `border-border`). Renders a colour chip plus its label,
 * proving the `@theme inline` token -> utility mapping resolves.
 */
export function Swatch({
  label,
  className,
}: {
  /** Human-readable token name shown under the chip. */
  label: string;
  /** Tailwind utility classes that paint the chip, e.g. "bg-accent". */
  className: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`h-12 w-full rounded-lg border border-border ${className}`}
        data-testid={`swatch-${label}`}
      />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
