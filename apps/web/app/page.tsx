import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { hu } from "@/lib/i18n/hu";

export const metadata: Metadata = {
  title: hu.landing.wordmark,
  description: hu.landing.heroLead,
};

/**
 * Root route → the public marketing Landing page (DESIGN-C). This screen lives
 * OUTSIDE the `(app)` route group, so it gets no app shell — it is a standalone
 * full-page layout. The app's real entry point (`/projekt`) is reached via the
 * landing's "Belépés a műhelybe" / "Kezdj el írni" CTAs. `/kitchen-sink` stays
 * available for kit development.
 */
export default function Home() {
  return <LandingPage />;
}
