import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Beállítások (Settings) placeholder — Settings hub lands in M8. */
export default function BeallitasokPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.beallitasokLabel}
      hint={hu.placeholders.beallitasokHint}
    />
  );
}
