import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Idősor (Timeline) placeholder — filled in M10 (V1). */
export default function IdosorPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.idosorLabel}
      hint={hu.placeholders.idosorHint}
    />
  );
}
