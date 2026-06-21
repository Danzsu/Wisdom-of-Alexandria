/**
 * @alexandria/shared — the FE↔BE type contract surface.
 *
 * The two `*.ts` files in this directory are GENERATED (do not hand-edit) by
 * `openapi-typescript` from the backend FastAPI OpenAPI documents:
 *   - `api.ts` ← `openapi/api.json` (dumped from `apps/api`)
 *   - `ai.ts`  ← `openapi/ai.json`  (dumped from `apps/ai`)
 *
 * Regenerate with `scripts/gen-shared-types.sh` (also run in CI, which
 * `git diff --exit-code`s this directory to fail on a stale checkout). The
 * backend OpenAPI is the SINGLE SOURCE OF TRUTH for these shapes; the frontend
 * Zod schemas are tied to the aliases below via a compile-time check (see
 * `apps/web/lib/api/*-types.ts`), so a divergence fails `tsc`.
 *
 * This barrel re-exports a CLEAN, named surface — the schemas the frontend
 * consumes — so callers write `import type { SceneRead } from "@alexandria/shared"`
 * rather than threading `components["schemas"][...]` everywhere.
 */
import type { components as ApiComponents } from "./api.js";
import type { components as AiComponents } from "./ai.js";

/** Raw generated component maps, re-exported for advanced/explicit indexing. */
export type { components as ApiComponents } from "./api.js";
export type { components as AiComponents } from "./ai.js";
export type { paths as ApiPaths } from "./api.js";
export type { paths as AiPaths } from "./ai.js";

type ApiSchemas = ApiComponents["schemas"];
type AiSchemas = AiComponents["schemas"];

/* ---------------------------------------------------------------------------
 * apps/api (`api.json`) — core writing-workspace resources.
 * ------------------------------------------------------------------------- */
export type ProjectRead = ApiSchemas["ProjectRead"];
export type BookRead = ApiSchemas["BookRead"];
export type SeriesRead = ApiSchemas["SeriesRead"];
export type ChapterRead = ApiSchemas["ChapterRead"];
export type SceneRead = ApiSchemas["SceneRead"];
export type BeatRead = ApiSchemas["BeatRead"];
export type CodexEntryRead = ApiSchemas["CodexEntryRead"];
export type CodexRelationRead = ApiSchemas["CodexRelationRead"];
export type PlotlineRead = ApiSchemas["PlotlineRead"];
export type PlotlineSceneRead = ApiSchemas["PlotlineSceneRead"];
export type SnippetRead = ApiSchemas["SnippetRead"];

/* ---------------------------------------------------------------------------
 * apps/ai (`ai.json`) — AI generation, providers, continuity.
 *
 * `RevisionRead` + `GenerationJobRead` are present in BOTH OpenAPI documents
 * (the Revision/Job rows cross the service boundary). The AI service is the
 * producer the frontend's AI flows consume, so the canonical aliases below
 * come from `ai.json`.
 * ------------------------------------------------------------------------- */
export type RevisionRead = AiSchemas["RevisionRead"];
export type GenerationJobRead = AiSchemas["GenerationJobRead"];
export type AIContextEntity = AiSchemas["ContextEntity"];
export type AIResult = AiSchemas["AIResult"];
export type AIDescribeResult = AiSchemas["AIDescribeResult"];
export type ContinuityWarning = AiSchemas["ContinuityWarning"];
export type ContinuityResult = AiSchemas["ContinuityResult"];
export type ModelInfo = AiSchemas["ModelInfo"];
export type ModelsResponse = AiSchemas["ModelsResponse"];
export type ProviderRead = AiSchemas["ProviderRead"];

/* ---------------------------------------------------------------------------
 * Compile-time contract-tie helpers.
 *
 * The frontend keeps hand-authored Zod schemas for RUNTIME validation, but ties
 * each `z.infer` to the GENERATED backend type above so a divergence fails
 * `tsc`. We deliberately do NOT use `satisfies z.ZodType<T>` nor a strict
 * `Equal<z.infer<S>, T>`: Zod's inferred output and openapi-typescript's output
 * disagree systematically on *optionality* (Zod `.default([])`/`.nullable()`
 * vs OpenAPI's `field?:` for Pydantic `Optional`/default fields) and the FE
 * intentionally NARROWS some free-string backend fields to unions
 * (`ModelInfo.kind`, `ProviderRead.type`). A strict structural equality would
 * flag those deliberate, correct differences as errors.
 *
 * Instead the tie is the conjunction of two tolerant-but-load-bearing checks
 * (see {@link MatchesContract}):
 *   1. `SameKeys` — the inferred shape and the generated type have the EXACT
 *      same set of property keys. This is the check the retired fixture
 *      drift-guard could never do: it catches a field ADD / REMOVE / RENAME on
 *      either side (a renamed/added/removed backend field changes the generated
 *      key set, so the committed Zod schema stops matching → `tsc` fails).
 *   2. `InferAssignable` — the inferred shape is assignable to the generated
 *      type (a one-directional value-type check). This catches a field whose
 *      TYPE drifts incompatibly (e.g. a `number` the FE still types as such
 *      after the backend made it a `string`), while tolerating the FE's
 *      narrowing (a union is assignable to its widening) and optionality skew.
 *
 * Usage (in the FE type modules):
 *   type _Tie = AssertContract<typeof sceneReadSchema, SceneRead>;
 * A failing tie surfaces as `Type 'false' does not satisfy the constraint
 * 'true'` on that line — i.e. `tsc`/`type-check` goes red.
 * ------------------------------------------------------------------------- */

/** Structural type-equality (the classic invariant-position trick). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;

/** The inferred Zod output shape and the generated type share the same keys. */
type SameKeys<Inferred, Generated> = Equal<
  keyof Inferred,
  keyof Generated
>;

/** The inferred Zod output shape is assignable to the generated type. */
type InferAssignable<Inferred, Generated> = Inferred extends Generated
  ? true
  : false;

/**
 * The conjunction tie: TRUE only when the Zod-inferred shape has the same key
 * set as the generated backend type AND is assignable to it. Either half going
 * false makes this `false`, which a consuming `AssertContract` then turns into
 * a `tsc` error.
 */
export type MatchesContract<Inferred, Generated> = SameKeys<
  Inferred,
  Generated
> extends true
  ? InferAssignable<Inferred, Generated> extends true
    ? true
    : false
  : false;

/**
 * Compile-time assertion: the type argument must be exactly `true`. Pair it
 * with {@link MatchesContract} as `type _Tie = Expect<MatchesContract<I, G>>` —
 * when the contract matches, `MatchesContract` is `true` and this resolves to
 * `true`; when it does NOT, `MatchesContract` is `false`, which violates the
 * `extends true` constraint → `tsc` error on that line.
 */
export type Expect<T extends true> = T;
