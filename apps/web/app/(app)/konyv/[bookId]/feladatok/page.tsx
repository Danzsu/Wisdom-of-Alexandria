import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** AI feladatok (AI jobs queue) placeholder — filled in M10 (V1). */
export default function FeladatokPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.feladatokLabel}
      hint={hu.placeholders.feladatokHint}
    />
  );
}
