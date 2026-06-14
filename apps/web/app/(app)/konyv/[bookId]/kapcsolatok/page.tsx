import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Kapcsolatok (Relations graph) placeholder — filled in M10 (V1). */
export default function KapcsolatokPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.kapcsolatokLabel}
      hint={hu.placeholders.kapcsolatokHint}
    />
  );
}
