import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Export placeholder — Markdown export lands in M8. */
export default function ExportPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.exportLabel}
      hint={hu.placeholders.exportHint}
    />
  );
}
