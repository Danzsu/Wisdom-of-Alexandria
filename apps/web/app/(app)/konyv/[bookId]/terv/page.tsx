import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

// M7: chapter/scene creation (Plan Board / scene CRUD) lands here.
/** Terv (Plan board) placeholder — filled in M7. */
export default function TervPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.tervLabel}
      hint={hu.placeholders.tervHint}
    />
  );
}
