import { BrandStar } from "@/components/kit/brand-star";

/**
 * Minimal centred screen placeholder used by M2 route segments so navigation
 * is verifiable before the real screens are built. Shows the screen's Hungarian
 * label and an optional milestone hint. Server-renderable (no client hooks).
 */
export function ScreenPlaceholder({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <BrandStar size={28} />
      <h1 className="m-0 font-serif text-[24px] font-semibold text-text">
        {label}
      </h1>
      {hint ? (
        <p className="m-0 max-w-prose text-[13px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
