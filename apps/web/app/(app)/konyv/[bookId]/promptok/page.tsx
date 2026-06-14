import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Prompt Library placeholder — filled in M10 (V1). */
export default function PromptokPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.promptokLabel}
      hint={hu.placeholders.promptokHint}
    />
  );
}
