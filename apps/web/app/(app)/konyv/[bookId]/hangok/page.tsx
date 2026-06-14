import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Hangkönyvtár (Audio library) placeholder — V2 visual stub (M11). */
export default function HangokPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.hangokLabel}
      hint={hu.placeholders.hangokHint}
    />
  );
}
