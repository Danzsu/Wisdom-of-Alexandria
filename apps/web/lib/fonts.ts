import {
  Cormorant_Garamond,
  Caveat,
  Inter,
  Literata,
} from "next/font/google";

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
 * UI / sans face. Inter replaces Source Sans 3 as the primary sans-serif.
 * Exposed as the `--font-sans` CSS variable, which the body font-family
 * resolves against. `font-sans` utilities now resolve to Inter.
 */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Display / editorial serif face. Used for chapter titles, hero headings, and
 * any typographically elevated UI surface. Exposed as `--font-display` CSS var
 * (mapped to `font-display` utility). Adoption in components is a later task.
 */
export const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

/**
 * Handwriting / annotation face. Used for notes, annotations, and handwritten
 * UI accents. Exposed as `--font-hand` CSS var (mapped to `font-hand` utility).
 * Adoption in components is a later task.
 */
export const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hand",
  display: "swap",
});
