import { ScreenPlaceholder } from "@/components/shell";
import { hu } from "@/lib/i18n/hu";

/** Chat placeholder — filled in M10 (V1). */
export default function ChatPage() {
  return (
    <ScreenPlaceholder
      label={hu.placeholders.chatLabel}
      hint={hu.placeholders.chatHint}
    />
  );
}
