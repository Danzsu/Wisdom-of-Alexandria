/**
 * Type augmentation for the `vitest-axe` matcher (`toHaveNoViolations`).
 *
 * vitest-axe ships an augmentation targeting the legacy `Vi` namespace, but
 * Vitest 4 resolves custom matchers through `declare module "vitest"` →
 * `interface Assertion` (same pattern `@testing-library/jest-dom` uses). We
 * augment that interface here so `expect(results).toHaveNoViolations()`
 * type-checks under strict mode. Runtime registration is in `vitest.setup.ts`.
 */
import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
