/**
 * Automated accessibility (axe-core) test helper (UX-4b).
 *
 * Wraps `vitest-axe`'s `axe()` runner with a project-wide rule config and a
 * single assertion helper, `expectNoA11yViolations`, used across the
 * `*.a11y.test.tsx` suites. The axe matcher (`toHaveNoViolations`) is registered
 * globally in `vitest.setup.ts` so any test can also assert directly.
 *
 * Why some rules are turned off by DEFAULT here:
 *
 * - `color-contrast`: axe computes contrast from COMPUTED layout colours. jsdom
 *   ships no layout/paint engine and no CSS cascade resolution for our Tailwind
 *   token variables, so every element resolves to transparent/black and axe
 *   either no-ops or reports false "insufficient contrast" hits. Contrast is
 *   covered instead by the design-token review + (future) Lighthouse run in a
 *   real browser — see `docs/16_a11y_axe_gate.md`. This is the ONLY rule we
 *   disable for an unavoidable jsdom limitation.
 *
 * Everything structural/semantic (roles, accessible names, labels, aria-*, list
 * structure, button-name, image-alt, form labels, duplicate ids, landmarks,
 * heading order) stays ENABLED — that is the value of the gate.
 */
import { expect } from "vitest";
import { axe } from "vitest-axe";
import type { RunOptions } from "axe-core";

/**
 * Rules disabled for every a11y assertion because they cannot be evaluated under
 * jsdom (no layout). Keep this list as small as possible and documented above.
 */
const JSDOM_UNSUPPORTED_RULES = {
  // Needs computed colours / layout — not available in jsdom.
  "color-contrast": { enabled: false },
} as const;

/**
 * Run axe against a rendered container and assert there are no violations.
 *
 * @param container The DOM node to scan. Pass the render `container` for inline
 *   components, or `document` for portalled overlays (Radix renders dialogs /
 *   menus / tooltips into a body-level portal that is OUTSIDE the render
 *   container, so they must be scanned at the document level).
 * @param options Per-test axe `RunOptions` — merged over the defaults. Use this
 *   to scope off a SPECIFIC rule for a documented, genuine jsdom false-positive
 *   (never to blanket-suppress a real violation).
 *
 * When scanning a whole `Document`, the page-level `region` rule is disabled:
 * isolated component tests render a bare overlay with no page landmarks
 * (`<main>`/`<nav>`), so `region` ("all content must be inside a landmark")
 * always fires — that is a property of the test harness, not the component.
 * `region` stays ENABLED for the screen-level tests that render real shells.
 */
export async function expectNoA11yViolations(
  container: Element | Document,
  options?: RunOptions,
): Promise<void> {
  const isDocument = container instanceof Document;
  const target = isDocument ? container.body : container;

  const rules: NonNullable<RunOptions["rules"]> = {
    ...JSDOM_UNSUPPORTED_RULES,
    ...(options?.rules ?? {}),
  };
  // Page-level landmark rule is meaningless for a bare portalled overlay.
  if (isDocument && rules.region === undefined) {
    rules.region = { enabled: false };
  }

  const results = await axe(target, { ...options, rules });

  expect(results).toHaveNoViolations();
}
