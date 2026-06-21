/**
 * Shared gate for the GSAP progressive-enhancement layer (UX-3a/3b onboarding,
 * relationship graph, timeline). The GSAP draw-ins are PURELY decorative: the
 * static render is always the baseline, so GSAP must NOT run when:
 *
 *   - there is no DOM (SSR),
 *   - the test env asks for the static baseline (jsdom has no layout/scroll so
 *     ScrollTrigger / measured tweens would be meaningless no-ops, and the tests
 *     assert the static markup),
 *   - `matchMedia` is unavailable, or
 *   - the user prefers reduced motion.
 *
 * The function is split out (and the env short-circuit made an explicit param)
 * specifically so the reduced-motion (`matchMedia`) branch is UNIT-TESTABLE
 * WITHOUT the `NODE_ENV === "test"` check swallowing it first. Component call
 * sites pass `process.env.NODE_ENV === "test"` for `isTestEnv`; the unit test
 * passes `false` and a mocked `matchMedia` to prove the reduced-motion gate.
 */

/**
 * Core, dependency-injected gate. Pure: every input is a parameter, so the
 * reduced-motion branch can be exercised independently of the runtime env.
 *
 * @param hasWindow   Whether a DOM `window` exists (SSR guard).
 * @param isTestEnv   Whether we are under the test runner (force static).
 * @param matchMediaFn The `window.matchMedia` reference, or undefined.
 */
export function canAnimateGsap(
  hasWindow: boolean,
  isTestEnv: boolean,
  matchMediaFn: ((query: string) => MediaQueryList) | undefined,
): boolean {
  if (!hasWindow) return false;
  if (isTestEnv) return false;
  if (typeof matchMediaFn !== "function") return false;
  return !matchMediaFn("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runtime convenience wrapper for component call sites. Reads the real `window`
 * + `process.env.NODE_ENV` and delegates to {@link canAnimateGsap}.
 */
export function canAnimateGsapNow(): boolean {
  const hasWindow = typeof window !== "undefined";
  return canAnimateGsap(
    hasWindow,
    process.env.NODE_ENV === "test",
    hasWindow && typeof window.matchMedia === "function"
      ? window.matchMedia.bind(window)
      : undefined,
  );
}
