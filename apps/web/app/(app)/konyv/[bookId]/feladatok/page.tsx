"use client";

/**
 * AI feladatok (AI jobs) screen — B1. Renders the live generation-jobs list for
 * the active book. The route only carries `bookId`; the list is scoped to it
 * server-side and polled so it stays live (history + failure surfacing).
 */
import { useParams } from "next/navigation";
import { JobsScreen } from "@/components/jobs/jobs-screen";

export default function FeladatokPage() {
  const params = useParams<{ bookId: string }>();
  return <JobsScreen bookId={params?.bookId} />;
}
