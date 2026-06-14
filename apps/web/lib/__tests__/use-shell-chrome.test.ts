import { describe, expect, it } from "vitest";
import { deriveChrome, segmentFromPathname } from "../use-shell-chrome";

describe("segmentFromPathname", () => {
  it("extracts the segment from a book route", () => {
    expect(segmentFromPathname("/konyv/demo/terv")).toBe("terv");
    expect(segmentFromPathname("/konyv/demo/iras/demo")).toBe("iras");
    expect(segmentFromPathname("/konyv/abc/codex")).toBe("codex");
  });

  it("returns null outside a book", () => {
    expect(segmentFromPathname("/projekt")).toBeNull();
    expect(segmentFromPathname("/")).toBeNull();
    expect(segmentFromPathname("/konyv/demo")).toBeNull();
  });
});

describe("deriveChrome", () => {
  it("projects picker hides all book chrome", () => {
    const c = deriveChrome("/projekt");
    expect(c.inBook).toBe(false);
    expect(c.showRail).toBe(false);
    expect(c.leftSidebar).toBeNull();
    expect(c.isWrite).toBe(false);
  });

  it("default book route shows the icon rail", () => {
    const c = deriveChrome("/konyv/demo/terv");
    expect(c.inBook).toBe(true);
    expect(c.showRail).toBe(true);
    expect(c.leftSidebar).toBe("rail");
    expect(c.isWrite).toBe(false);
  });

  it("Write route shows the chapter tree + StatusBar flag", () => {
    const c = deriveChrome("/konyv/demo/iras/demo");
    expect(c.leftSidebar).toBe("tree");
    expect(c.isWrite).toBe(true);
    expect(c.segment).toBe("iras");
  });

  it("Codex route shows the codex sidebar", () => {
    const c = deriveChrome("/konyv/demo/codex");
    expect(c.leftSidebar).toBe("codex");
    expect(c.isWrite).toBe(false);
  });
});
