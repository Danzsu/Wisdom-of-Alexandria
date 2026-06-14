import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Áttekintés (Review / overview) placeholder — filled in M10 (V1). */
export default function AttekintesPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.attekintesLabel}
      hint={hu.placeholders.attekintesHint}
    />
  );
}
