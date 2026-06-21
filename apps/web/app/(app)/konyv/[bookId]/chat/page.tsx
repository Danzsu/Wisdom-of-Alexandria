"use client";

/**
 * Kutatás (Codex/manuscript RAG Q&A) screen — the book's `chat` route. Research
 * is project-scoped but the route only carries `bookId`, so the owning project
 * is resolved inside {@link ResearchScreen} via the shared `useBookProjectId`.
 */
import { useParams } from "next/navigation";
import { ResearchScreen } from "@/components/research/research-screen";

export default function ChatPage() {
  const params = useParams<{ bookId: string }>();
  return <ResearchScreen bookId={params?.bookId} />;
}
