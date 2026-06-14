import { PlanBoard } from "@/components/plan";

/**
 * Terv (Plan Board) route — Rács / Mátrix / Vázlat views, dnd-kit reorder and
 * chapter/scene CREATE (M7). The whole screen is the client {@link PlanBoard};
 * the route param `bookId` is read inside it via `useParams`.
 */
export default function TervPage() {
  return <PlanBoard />;
}
