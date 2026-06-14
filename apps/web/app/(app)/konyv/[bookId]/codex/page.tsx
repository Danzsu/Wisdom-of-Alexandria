import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Codex placeholder — the Codex sidebar replaces the rail; detail lands in M6. */
export default function CodexPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.codexLabel}
      hint={hu.placeholders.codexHint}
    />
  );
}
