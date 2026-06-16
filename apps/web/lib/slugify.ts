/**
 * Hungarian-aware ASCII-folding slugify, used to build a safe export filename
 * from a book title (M8 Export).
 *
 * The backend's export endpoint sets a `Content-Disposition` filename derived
 * the same way (NFKD + strip non-ASCII + spaces→`_`), and we honor that when it
 * is present. This util is the CLIENT-SIDE fallback for when the header is
 * absent (or for the live filename preview), so the two must agree on the
 * Hungarian-letter mapping:
 *
 *   á→a  é→e  í→i  ó/ö/ő→o  ú/ü/ű→u  (and their uppercase forms)
 *
 * NFKD normalization already decomposes á/é/í/ó/ö/ú and their accents, but the
 * Hungarian long umlauts ő (U+0151) and ű (U+0171) decompose to o/u + a double
 * acute combining mark that `encode("ascii","ignore")` drops correctly — so
 * NFKD + ASCII-strip is sufficient. We still apply an explicit map first as a
 * defensive, runtime-independent guarantee (some JS engines historically
 * differed on the double-acute decomposition).
 */

/** Explicit Hungarian accented → base-letter map (defensive, pre-NFKD). */
const HU_FOLD: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ö: "o",
  ő: "o",
  ú: "u",
  ü: "u",
  ű: "u",
  Á: "A",
  É: "E",
  Í: "I",
  Ó: "O",
  Ö: "O",
  Ő: "O",
  Ú: "U",
  Ü: "U",
  Ű: "U",
};

/**
 * Fold a string to a lowercase ASCII slug: Hungarian accents → base letters,
 * runs of whitespace → single `_`, every remaining non-`[a-z0-9_]` char removed.
 * Returns `""` for input that folds to nothing (the caller supplies a fallback).
 */
export function slugify(input: string): string {
  const folded = Array.from(input)
    .map((ch) => HU_FOLD[ch] ?? ch)
    .join("");

  return folded
    .normalize("NFKD")
    // Drop combining diacritical marks left by NFKD decomposition.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Collapse any run of whitespace to a single underscore.
    .replace(/\s+/g, "_")
    // Strip everything that is not an ASCII word char or underscore.
    .replace(/[^a-z0-9_]/g, "")
    // Collapse duplicate underscores produced by stripped punctuation.
    .replace(/_+/g, "_")
    // Trim leading/trailing underscores.
    .replace(/^_+|_+$/g, "");
}

/**
 * Build an export filename for a title + extension. Folds the title to an ASCII
 * slug and appends `.<ext>`; falls back to `export.<ext>` when the title folds
 * to an empty slug (e.g. a title made entirely of stripped characters).
 *
 * Used as the CLIENT-SIDE fallback for the download name when the server omits
 * a `Content-Disposition` (and for the live filename preview). The extension is
 * the format's file extension (`md` / `docx` / `epub`).
 */
export function exportFilename(title: string, extension: string): string {
  const slug = slugify(title);
  return `${slug.length > 0 ? slug : "export"}.${extension}`;
}

/**
 * Build the Markdown export filename for a book title (thin wrapper over
 * {@link exportFilename} for the `.md` case). Retained for callers that only
 * deal with Markdown (e.g. the filename preview default).
 */
export function markdownFilename(title: string): string {
  return exportFilename(title, "md");
}

/**
 * Parse a filename out of a `Content-Disposition` header value, preferring the
 * RFC 5987 `filename*` (UTF-8) form and falling back to the plain `filename`.
 * Returns `null` when no filename token is present (the caller then builds one
 * client-side). Never throws — a malformed header just yields `null`.
 */
export function filenameFromContentDisposition(
  header: string | null,
): string | null {
  if (!header) return null;

  // Prefer filename*=UTF-8''<percent-encoded> (RFC 5987).
  const extended = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (extended?.[1]) {
    const raw = extended[1].trim().replace(/^"|"$/g, "");
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded.length > 0) return decoded;
    } catch {
      // A malformed percent-encoding falls through to the plain filename below
      // rather than throwing — we still try the ASCII token.
    }
  }

  // Plain filename="..." (or unquoted).
  const plain = /filename\s*=\s*("?)([^";]+)\1/i.exec(header);
  if (plain?.[2]) {
    const value = plain[2].trim();
    if (value.length > 0) return value;
  }

  return null;
}
