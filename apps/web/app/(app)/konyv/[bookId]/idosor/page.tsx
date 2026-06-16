"use client";

/**
 * Idősor (chapter/scene timeline) screen (UX-3b). The timeline is book-scoped,
 * but POV character names are resolved from the project's codex, so the screen
 * resolves the owning project via `useBookProjectId` (mirroring Kapcsolatok).
 */
import { useParams } from "next/navigation";
import { TimelineScreen } from "@/components/timeline/timeline-screen";

export default function IdosorPage() {
  const params = useParams<{ bookId: string }>();
  return <TimelineScreen bookId={params?.bookId} />;
}
