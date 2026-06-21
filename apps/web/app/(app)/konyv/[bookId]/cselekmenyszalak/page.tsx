"use client";

/**
 * Cselekményszálak (subplots) screen (Plotline-b). The plotlines are
 * project-scoped, but the route only carries `bookId`, so the screen resolves
 * the owning project via `useBookProjectId` (mirroring Kapcsolatok / Idősor).
 */
import { useParams } from "next/navigation";
import { PlotlinesScreen } from "@/components/plotlines/plotlines-screen";

export default function CselekmenyszalakPage() {
  const params = useParams<{ bookId: string }>();
  return <PlotlinesScreen bookId={params?.bookId} />;
}
