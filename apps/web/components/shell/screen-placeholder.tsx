import { BrandStar } from "@/components/kit/brand-star";
import { EmptyState } from "@/components/kit/empty-state";

/**
 * Minimal centred screen placeholder used by M2 route segments so navigation
 * is verifiable before the real screens are built. Shows the screen's Hungarian
 * label and an optional milestone hint. Server-renderable (no client hooks).
 *
 * Public API: `{ label, hint? }` — unchanged; three route segments rely on it.
 */
export function ScreenPlaceholder({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <EmptyState
        icon={<BrandStar size={28} />}
        title={label}
        description={hint}
      />
    </div>
  );
}
