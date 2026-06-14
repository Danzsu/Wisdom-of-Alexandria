import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Cselekményszálak (Subplots) placeholder — filled in M10 (V1). */
export default function CselekmenyszalakPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.cselekmenyszalakLabel}
      hint={hu.placeholders.cselekmenyszalakHint}
    />
  );
}
