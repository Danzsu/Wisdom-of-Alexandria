import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

/**
 * Root → projects picker. The app's real entry point is `/projekt`; the M0 demo
 * home page has been retired now that the shell exists. `/kitchen-sink` stays
 * available for kit development.
 */
export default function Home() {
  redirect(routes.projects());
}
