/**
 * Tiny platform helpers for rendering keyboard shortcuts. The "Mod" key is ⌘ on
 * macOS and Ctrl elsewhere — Tiptap / browsers map `Cmd` and `Ctrl` to the same
 * intent, so the UI must label it per-platform. Detection is best-effort and
 * SSR-safe (defaults to non-Mac on the server, corrected on the client).
 */

/** True on macOS / iPadOS (best-effort; false during SSR). */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  // `userAgentData.platform` is the modern signal; fall back to platform/UA.
  const uaData = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  const platform =
    uaData?.platform ?? navigator.platform ?? navigator.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** The platform-appropriate primary modifier symbol: ⌘ on Mac, "Ctrl" else. */
export function modKeyLabel(): string {
  return isMac() ? "⌘" : "Ctrl";
}

/**
 * Join modifier + key into a display chord, e.g. `["Mod", "K"]` → "⌘K" /
 * "Ctrl+K". The literal token "Mod" is resolved to the platform modifier; every
 * other token is kept verbatim. Mac uses no separator (⌘K); others use "+".
 */
export function formatChord(keys: readonly string[]): string {
  const mac = isMac();
  const sep = mac ? "" : "+";
  return keys.map((k) => (k === "Mod" ? modKeyLabel() : k)).join(sep);
}
