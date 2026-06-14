import { ProjectsDashboard } from "@/components/projects/projects-dashboard";

/**
 * Projektek — the project picker (outside any book, so the shell hides the icon
 * rail and in-book TopBar affordances). M3 ships the real dashboard + New-book
 * wizard, wired to the backend via TanStack Query. The screen body is a client
 * component (data hooks + wizard state); this segment is the server entry.
 */
export default function ProjektPage() {
  return <ProjectsDashboard />;
}
