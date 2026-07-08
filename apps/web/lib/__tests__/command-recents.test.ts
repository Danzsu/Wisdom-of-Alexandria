/**
 * Command-palette recents persistence (design pushRecent parity).
 *
 * The design mock persists the last 6 selected commands to
 * localStorage("woa-recent-cmds") — dedup by label, newest first. Our stored
 * shape additionally keeps enough to RE-EXECUTE the row later (group for the
 * leading visual, href/action as the target); scene/codex hrefs may go stale
 * after a deletion — navigating to a stale route is acceptable, so no
 * liveness data is stored.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  RECENT_COMMANDS_KEY,
  RECENT_COMMANDS_MAX,
  pushRecentCommand,
  readRecentCommands,
  recentCommandResults,
  type CommandResult,
} from "../command-data";

function stored(): unknown {
  return JSON.parse(localStorage.getItem(RECENT_COMMANDS_KEY) ?? "null");
}

function sceneResult(label: string, href: string): CommandResult {
  return { id: `scene-${label}`, group: "scenes", label, meta: "I. fejezet", href };
}

describe("command-palette recents (woa-recent-cmds)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses the design mock's key and cap", () => {
    expect(RECENT_COMMANDS_KEY).toBe("woa-recent-cmds");
    expect(RECENT_COMMANDS_MAX).toBe(6);
  });

  it("push persists the re-executable shape (label + group + target, no meta/id)", () => {
    pushRecentCommand(sceneResult("Rejtett szoba", "/konyv/b1/iras/s1"));
    expect(stored()).toEqual([
      { label: "Rejtett szoba", group: "scenes", href: "/konyv/b1/iras/s1" },
    ]);

    pushRecentCommand({
      id: "action-theme",
      group: "actions",
      label: "Téma váltása",
      action: "theme",
    });
    expect(stored()).toEqual([
      { label: "Téma váltása", group: "actions", action: "theme" },
      { label: "Rejtett szoba", group: "scenes", href: "/konyv/b1/iras/s1" },
    ]);
  });

  it("dedups by label: re-selecting moves the entry to the front, no duplicate", () => {
    pushRecentCommand(sceneResult("A", "/a"));
    pushRecentCommand(sceneResult("B", "/b"));
    pushRecentCommand(sceneResult("A", "/a"));
    const entries = readRecentCommands();
    expect(entries.map((e) => e.label)).toEqual(["A", "B"]);
  });

  it("caps at 6, newest first, oldest dropped", () => {
    for (let i = 1; i <= 7; i += 1) {
      pushRecentCommand(sceneResult(`Jelenet ${i}`, `/scene/${i}`));
    }
    const entries = readRecentCommands();
    expect(entries).toHaveLength(RECENT_COMMANDS_MAX);
    expect(entries.map((e) => e.label)).toEqual([
      "Jelenet 7",
      "Jelenet 6",
      "Jelenet 5",
      "Jelenet 4",
      "Jelenet 3",
      "Jelenet 2",
    ]);
  });

  it("read tolerates malformed storage: bad JSON / non-array → []", () => {
    localStorage.setItem(RECENT_COMMANDS_KEY, "{definitely not json");
    expect(readRecentCommands()).toEqual([]);
    localStorage.setItem(RECENT_COMMANDS_KEY, '{"label":"obj not array"}');
    expect(readRecentCommands()).toEqual([]);
    localStorage.removeItem(RECENT_COMMANDS_KEY);
    expect(readRecentCommands()).toEqual([]);
  });

  it("read drops junk items and sanitizes fields (unknown group → actions, junk target dropped)", () => {
    localStorage.setItem(
      RECENT_COMMANDS_KEY,
      JSON.stringify([
        { label: "Jó", group: "scenes", href: "/x" },
        { label: "", group: "scenes" }, // empty label → dropped
        { group: "codex" }, // no label → dropped
        42, // not an object → dropped
        { label: "Fura", group: "bogus", href: 7, action: "hack" }, // sanitized
      ]),
    );
    expect(readRecentCommands()).toEqual([
      { label: "Jó", group: "scenes", href: "/x" },
      { label: "Fura", group: "actions" },
    ]);
  });

  it("read slices an over-long stored list to 6", () => {
    localStorage.setItem(
      RECENT_COMMANDS_KEY,
      JSON.stringify(
        Array.from({ length: 9 }, (_, i) => ({
          label: `L${i}`,
          group: "scenes",
        })),
      ),
    );
    expect(readRecentCommands()).toHaveLength(RECENT_COMMANDS_MAX);
  });

  it("recentCommandResults maps entries to renderable results with unique ids", () => {
    const results = recentCommandResults([
      { label: "Szelene", group: "codex", href: "/konyv/b/codex?entry=c1" },
      { label: "Téma váltása", group: "actions", action: "theme" },
    ]);
    expect(results).toEqual([
      {
        id: "recent-0",
        group: "codex",
        label: "Szelene",
        href: "/konyv/b/codex?entry=c1",
        action: undefined,
      },
      {
        id: "recent-1",
        group: "actions",
        label: "Téma váltása",
        href: undefined,
        action: "theme",
      },
    ]);
  });
});
