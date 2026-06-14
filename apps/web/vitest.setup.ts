import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./test/msw/server";

// Start the MSW server before any test runs; fail loudly on a request that no
// handler covers so a missing mock can never be mistaken for a passing test.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

// Unmount React trees, reset the DOM and reset any per-test MSW overrides
// between tests so mounts/handlers never leak state into one another.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

/* ----------------------------------------------------------------------------
 * jsdom polyfills for Radix primitives.
 * jsdom ships no ResizeObserver / Pointer Capture / scrollIntoView, which Radix
 * Slider, Select and Dialog rely on. These are environment shims for tests only
 * — they have no effect on production code.
 * -------------------------------------------------------------------------- */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window !== "undefined") {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
}
