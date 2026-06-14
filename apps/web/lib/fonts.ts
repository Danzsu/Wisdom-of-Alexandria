import { Literata, Source_Sans_3 } from "next/font/google";

/**
 * Manuscript / serif face. Literata carries the optical-size and italic axes,
 * so we request normal + italic across the 400–700 weights the UI uses.
 * Exposed as the `--font-literata` CSS variable (mapped to `font-serif`).
 */
export const literata = Literata({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-literata",
  display: "swap",
});

/**
 * UI / sans face. Exposed as the `--font-sans` CSS variable, which the body
 * font-family resolves against.
 */
export const sourceSans3 = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
