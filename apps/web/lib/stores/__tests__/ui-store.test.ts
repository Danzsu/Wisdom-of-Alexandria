import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore, SPARK_DURATION_MS } from "../ui-store";

/** Reset the store to its initial state between tests. */
function resetStore() {
  useUIStore.setState({
    openMenu: null,
    commandOpen: false,
    sparkActive: false,
  });
}

describe("useUIStore", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    useUIStore.getState().clearSpark();
    vi.useRealTimers();
  });

  describe("menus (single-open)", () => {
    it("opens a single menu via setMenu", () => {
      useUIStore.getState().setMenu("user");
      expect(useUIStore.getState().openMenu).toBe("user");
    });

    it("switching menus closes the previous one (only one open)", () => {
      useUIStore.getState().setMenu("user");
      useUIStore.getState().setMenu("tools");
      expect(useUIStore.getState().openMenu).toBe("tools");
    });

    it("toggleMenu opens then closes the same menu", () => {
      useUIStore.getState().toggleMenu("project");
      expect(useUIStore.getState().openMenu).toBe("project");
      useUIStore.getState().toggleMenu("project");
      expect(useUIStore.getState().openMenu).toBeNull();
    });

    it("toggleMenu switches between different menus", () => {
      useUIStore.getState().toggleMenu("user");
      useUIStore.getState().toggleMenu("tools");
      expect(useUIStore.getState().openMenu).toBe("tools");
    });

    it("closeMenus clears the open menu", () => {
      useUIStore.getState().setMenu("user");
      useUIStore.getState().closeMenus();
      expect(useUIStore.getState().openMenu).toBeNull();
    });
  });

  describe("command palette", () => {
    it("opens and closes", () => {
      useUIStore.getState().openCommand();
      expect(useUIStore.getState().commandOpen).toBe(true);
      useUIStore.getState().closeCommand();
      expect(useUIStore.getState().commandOpen).toBe(false);
    });

    it("opening the command palette closes any open menu", () => {
      useUIStore.getState().setMenu("tools");
      useUIStore.getState().openCommand();
      expect(useUIStore.getState().openMenu).toBeNull();
      expect(useUIStore.getState().commandOpen).toBe(true);
    });

    it("toggleCommand flips the flag and closes menus", () => {
      useUIStore.getState().setMenu("user");
      useUIStore.getState().toggleCommand();
      expect(useUIStore.getState().commandOpen).toBe(true);
      expect(useUIStore.getState().openMenu).toBeNull();
      useUIStore.getState().toggleCommand();
      expect(useUIStore.getState().commandOpen).toBe(false);
    });
  });

  describe("sparkfield", () => {
    it("triggerSpark sets sparkActive and auto-clears after the duration", () => {
      vi.useFakeTimers();
      useUIStore.getState().triggerSpark();
      expect(useUIStore.getState().sparkActive).toBe(true);

      vi.advanceTimersByTime(SPARK_DURATION_MS - 1);
      expect(useUIStore.getState().sparkActive).toBe(true);

      vi.advanceTimersByTime(1);
      expect(useUIStore.getState().sparkActive).toBe(false);
    });

    it("re-triggering debounces to a single clear (timer is reset)", () => {
      vi.useFakeTimers();
      useUIStore.getState().triggerSpark();
      vi.advanceTimersByTime(SPARK_DURATION_MS - 100);
      // Re-trigger before the first timer fires.
      useUIStore.getState().triggerSpark();
      expect(useUIStore.getState().sparkActive).toBe(true);

      // The original timer would have fired here, but it was cancelled.
      vi.advanceTimersByTime(100);
      expect(useUIStore.getState().sparkActive).toBe(true);

      // Only after the full second duration from the re-trigger does it clear.
      vi.advanceTimersByTime(SPARK_DURATION_MS - 100);
      expect(useUIStore.getState().sparkActive).toBe(false);
    });

    it("clearSpark turns sparkActive off immediately and cancels the timer", () => {
      vi.useFakeTimers();
      useUIStore.getState().triggerSpark();
      useUIStore.getState().clearSpark();
      expect(useUIStore.getState().sparkActive).toBe(false);
      // Advancing past the duration must not re-toggle anything.
      vi.advanceTimersByTime(SPARK_DURATION_MS * 2);
      expect(useUIStore.getState().sparkActive).toBe(false);
    });
  });
});
