"use client";

/**
 * Kapcsolatok (relationship graph) screen (UX-3a). Relations are project-scoped
 * but the route only carries `bookId`, so the owning project is resolved via the
 * reused `useBookProjectId` resolver inside {@link RelationsScreen}.
 */
import { useParams } from "next/navigation";
import { RelationsScreen } from "@/components/relations/relations-screen";

export default function KapcsolatokPage() {
  const params = useParams<{ bookId: string }>();
  return <RelationsScreen bookId={params?.bookId} />;
}
