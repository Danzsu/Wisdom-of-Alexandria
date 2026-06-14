import { ScreenPlaceholder } from "@/components/shell";

/**
 * Írás (Write view) placeholder. This is the only route that shows the
 * StatusBar (rendered by the shell) and the AI-inspector slot; the chapter-tree
 * sidebar replaces the icon rail. The Tiptap editor itself arrives in M4.
 */
export default function IrasPage() {
  return (
    <ScreenPlaceholder label="Írás" hint="A kézirat-szerkesztő az M4-ben érkezik." />
  );
}
