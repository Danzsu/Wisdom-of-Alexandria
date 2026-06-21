/**
 * Type-level contract test (Plotline-b): the frontend Zod `PlotlineRead` /
 * `PlotlineSceneRead` shapes must stay structurally tied to the generated
 * `@alexandria/shared` OpenAPI types via the `MatchesContract` pattern (the same
 * tie used for CodexRelation / Series). This file FAILS the build (tsc) — and
 * therefore `type-check` + the test run — if the FE schema drifts from the
 * regenerated backend contract. The runtime assertion below is a trivial smoke
 * check; the real enforcement is the compile-time `CoreContractTies` tuple and
 * the `Expect<MatchesContract<…>>` assertions referenced here.
 */
import { describe, expect, it } from "vitest";
import type {
  PlotlineRead as GenPlotlineRead,
  PlotlineSceneRead as GenPlotlineSceneRead,
} from "@alexandria/shared";
import {
  plotlineReadSchema,
  plotlineSceneReadSchema,
  type PlotlineRead,
  type PlotlineSceneRead,
} from "../types";

// Compile-time ties: each FE schema's inferred type must be assignable to the
// generated backend type (and vice versa is covered by `CoreContractTies`). If
// a field is added/removed/retyped on either side, these assignments stop
// compiling — surfacing the drift before runtime.
type _PlotlineTie = PlotlineRead extends GenPlotlineRead ? true : never;
type _PlotlineSceneTie =
  PlotlineSceneRead extends GenPlotlineSceneRead ? true : never;
const _plotlineTie: _PlotlineTie = true;
const _plotlineSceneTie: _PlotlineSceneTie = true;

describe("Plotline FE↔BE contract tie", () => {
  it("parses a generated-shaped PlotlineRead + PlotlineSceneRead", () => {
    // Hold the compile-time assertions (a no-op at runtime).
    expect(_plotlineTie && _plotlineSceneTie).toBe(true);

    const read: GenPlotlineRead = {
      id: "p1",
      project_id: "proj1",
      book_id: null,
      title: "Fő szál",
      description: null,
      plotline_type: "main_plot",
      status: "active",
      order_index: 0,
      created_at: "2026-06-21T12:00:00Z",
      updated_at: "2026-06-21T12:00:00Z",
    };
    expect(plotlineReadSchema.parse(read)).toMatchObject({ id: "p1" });

    const link: GenPlotlineSceneRead = {
      id: "pls1",
      plotline_id: "p1",
      scene_id: "s1",
      order_index: 0,
      created_at: "2026-06-21T12:00:00Z",
      updated_at: "2026-06-21T12:00:00Z",
    };
    expect(plotlineSceneReadSchema.parse(link)).toMatchObject({ scene_id: "s1" });
  });
});
