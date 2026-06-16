import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./test/msw/server";
import {
  resetCodexStore,
  resetPlanStore,
  resetRelationStore,
} from "./test/msw/handlers";

// Start the MSW server before any test runs; fail loudly on a request that no
// handler covers so a missing mock can never be mistaken for a passing test.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

// Unmount React trees, reset the DOM, reset any per-test MSW overrides and the
// in-memory stateful stores between tests so mounts/handlers/store state never
// leak from one test into another.
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetPlanStore();
  resetCodexStore();
  resetRelationStore();
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

  /* --------------------------------------------------------------------------
   * ProseMirror / Tiptap layout shims (test-only). jsdom does not implement
   * geometry (`getClientRects` / `getBoundingClientRect`), which ProseMirror
   * calls when it scrolls the selection into view after a transaction. Without
   * these, editor edits raise async "getClientRects is not a function" errors
   * during teardown. Returning an empty DOMRect list is enough — measurement is
   * never asserted, only that it doesn't throw.
   * ----------------------------------------------------------------------- */
  const emptyRect: DOMRect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON: () => ({}),
  };
  const emptyRectList = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  } as unknown as DOMRectList;

  if (!window.HTMLElement.prototype.getClientRects) {
    window.HTMLElement.prototype.getClientRects = () => emptyRectList;
  }
  if (!window.HTMLElement.prototype.getBoundingClientRect) {
    window.HTMLElement.prototype.getBoundingClientRect = () => emptyRect;
  }
  if (typeof window.Range !== "undefined") {
    if (!window.Range.prototype.getClientRects) {
      window.Range.prototype.getClientRects = () => emptyRectList;
    }
    if (!window.Range.prototype.getBoundingClientRect) {
      window.Range.prototype.getBoundingClientRect = () => emptyRect;
    }
  }
}
