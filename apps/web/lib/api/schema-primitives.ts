import { z } from "zod";

/**
 * UUID-bearing id field. Defined ONCE and shared across the API schema modules
 * (`types.ts`, `ai-types.ts`, `providers.ts`) so the id primitive cannot
 * silently diverge — e.g. one module tightening to `.uuid()` while the others
 * stay `.min(1)`.
 *
 * The backend types these as `uuid.UUID`, but we only validate "non-empty
 * string" here: strict RFC-4122 version/variant checks would reject valid
 * server ids and are an unnecessary frontend over-reach.
 */
export const idString = z.string().min(1);
