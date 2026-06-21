/**
 * Negative self-check for the a11y gate (UX-4b teeth proof).
 *
 * The `*.a11y.test.tsx` suites all assert NO violations — but a gate that can
 * only ever pass is theater: if every rule were disabled, or axe were a no-op,
 * those green assertions would prove nothing. This file renders deliberately
 * BROKEN DOM and asserts `expectNoA11yViolations` REJECTS (and the
 * `toHaveNoViolations` matcher FAILS) — proving the enabled rules actually fire.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { expectNoA11yViolations } from "@/test/a11y";

describe("a11y gate negative self-check (teeth)", () => {
  it("REJECTS an <img> with no alt (image-alt fires)", async () => {
    // eslint-disable-next-line jsx-a11y/alt-text
    const { container } = render(<img src="x.png" />);
    await expect(expectNoA11yViolations(container)).rejects.toThrow();
  });

  it("REJECTS a <button> with no accessible name (button-name fires)", async () => {
    const { container } = render(<button type="button" />);
    await expect(expectNoA11yViolations(container)).rejects.toThrow();
  });

  it("REJECTS a <select> with no accessible name (select-name fires)", async () => {
    const { container } = render(
      <select>
        <option value="a">a</option>
      </select>,
    );
    // Goes through `expectNoA11yViolations` — proving the gate helper (not just a
    // raw axe call) actually rejects a real, structural violation.
    await expect(expectNoA11yViolations(container)).rejects.toThrow();
  });

  it("REJECTS via the raw matcher too (toHaveNoViolations has teeth)", async () => {
    // A second proof at the matcher level: a no-op axe would report no
    // violations and this expectation would NOT throw.
    const { container } = render(<button type="button" />);
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(() => expect(results).toHaveNoViolations()).toThrow();
  });

  it("ACCEPTS a well-formed control (the gate is not stuck rejecting)", async () => {
    const { container } = render(
      <button type="button">Mentés</button>,
    );
    // The complementary positive: a correct DOM passes, so the rejections above
    // are caused by the violations, not a broken matcher.
    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });
});
