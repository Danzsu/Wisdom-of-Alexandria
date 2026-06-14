import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";

/**
 * The `(app)` route group renders the persistent Alexandria shell once. Every
 * child segment renders only its main-area content; the TopBar, sidebars,
 * StatusBar, sparkfield and command palette are owned by the shell and persist
 * across navigation.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
