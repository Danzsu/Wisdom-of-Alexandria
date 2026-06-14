import { describe, expect, it } from "vitest";
import { COMMAND_RESULTS, filterCommands } from "../command-data";

describe("filterCommands", () => {
  it("returns everything for an empty query", () => {
    expect(filterCommands(COMMAND_RESULTS, "")).toHaveLength(
      COMMAND_RESULTS.length,
    );
    expect(filterCommands(COMMAND_RESULTS, "   ")).toHaveLength(
      COMMAND_RESULTS.length,
    );
  });

  it("matches on the label (case-insensitive)", () => {
    const hits = filterCommands(COMMAND_RESULTS, "szelene");
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe("Szelene");
  });

  it("matches on the meta text", () => {
    const hits = filterCommands(COMMAND_RESULTS, "karakter");
    expect(hits.some((r) => r.label === "Szelene")).toBe(true);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterCommands(COMMAND_RESULTS, "zzzznomatch")).toHaveLength(0);
  });
});
