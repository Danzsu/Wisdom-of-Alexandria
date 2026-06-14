import { ScreenPlaceholder } from "@/components/shell";

/**
 * Projektek — the project picker (outside any book, so the shell hides the icon
 * rail and in-book TopBar affordances). M2 ships a placeholder; the real
 * dashboard + New-book wizard land in M3.
 */
export default function ProjektPage() {
  return (
    <ScreenPlaceholder
      label="Projektek"
      hint="A projekt-választó és az új könyv varázsló az M3-ban érkezik."
    />
  );
}
