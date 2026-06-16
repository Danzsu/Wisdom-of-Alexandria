import { afterEach, describe, expect, it, vi } from "vitest";
import { formatChord, isMac, modKeyLabel } from "@/lib/platform";

/** Stub navigator.userAgentData.platform for the duration of one assertion. */
function withPlatform(platform: string, fn: () => void) {
  const original = Object.getOwnPropertyDescriptor(navigator, "userAgentData");
  Object.defineProperty(navigator, "userAgentData", {
    value: { platform },
    configurable: true,
  });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(navigator, "userAgentData", original);
    else
      Object.defineProperty(navigator, "userAgentData", {
        value: undefined,
        configurable: true,
      });
  }
}

describe("platform helpers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("detects macOS and renders ⌘ with no separator", () => {
    withPlatform("macOS", () => {
      expect(isMac()).toBe(true);
      expect(modKeyLabel()).toBe("⌘");
      expect(formatChord(["Mod", "K"])).toBe("⌘K");
    });
  });

  it("treats Windows as non-Mac and renders Ctrl + separator", () => {
    withPlatform("Windows", () => {
      expect(isMac()).toBe(false);
      expect(modKeyLabel()).toBe("Ctrl");
      expect(formatChord(["Mod", "K"])).toBe("Ctrl+K");
    });
  });

  it("keeps non-Mod tokens verbatim", () => {
    withPlatform("Windows", () => {
      expect(formatChord(["Esc"])).toBe("Esc");
    });
  });
});
