// drift-guard: INTERIM FE↔BE contract guard (A11).
//
// This couples the hand-maintained frontend Read types to representative
// response fixtures (the MSW fixtures the rest of the suite already exchanges
// with the mock backend). It serves two honest, LIMITED purposes:
//
//   1. Compile-time (`satisfies <Type>`): if a Read TYPE changes without the
//      fixture being updated to match (or vice-versa), `tsc` (the `type-check`
//      script + the Vitest type-aware run) FAILS. So a FE-type/fixture
//      divergence can no longer land silently.
//   2. Runtime: a few `expect` assertions pin that the load-bearing fields
//      exist with the expected JS types (`id`/string, `created_at`/string, and
//      the enum-ish discriminators), documenting the contract in an executable
//      form.
//
// What this does NOT do (be honest): it does NOT auto-detect a SILENT BACKEND
// schema change. If the real FastAPI response gains/loses/renames a field, this
// test stays green as long as the FE type and these fixtures still agree with
// each other — because nothing here is generated from the backend's OpenAPI
// schema. Closing that gap is the DEFERRED `packages/shared` + OpenAPI-generated
// types work; until that lands, this is the agreed interim guard. It catches a
// FE-side type/fixture drift and pins the contract shape we believe the backend
// returns.
import { describe, expect, it } from "vitest";
import type {
  BookRead,
  CodexEntryRead,
  ProjectRead,
  SceneRead,
  SeriesRead,
} from "@/lib/api/types";
import type {
  AIResult,
  GenerationJobRead,
  RevisionRead,
} from "@/lib/api/ai-types";
import type { ProviderRead } from "@/lib/api/providers";
import {
  FAROSZ_BOOK,
  FAROSZ_CODEX,
  FAROSZ_PROJECT,
  FAROSZ_SERIES,
  PROVIDER_GEMINI,
  SCENE_ACTIVE,
} from "@/test/msw/fixtures";

/* ---------------------------------------------------------------------------
 * Representative response shapes, pinned to the Read types via `satisfies`.
 *
 * Each value is typed `satisfies <Read>`: it must be assignable to the Read
 * type AND keep its own (wider-or-equal) literal shape. Changing the Read type
 * OR one of these literals in isolation makes one side stop satisfying the
 * other → a `tsc` error. The two fixtures the suite already ships
 * (SCENE_ACTIVE, FAROSZ_CODEX[0], PROVIDER_GEMINI) are re-checked here; the two
 * not exported as standalone fixtures (RevisionRead, GenerationJobRead — only
 * built by private `makeRevision`/`makeJob` factories) get minimal typed
 * literals so all five Read types are covered.
 * ------------------------------------------------------------------------- */

/** SceneRead — re-checks the shared fixture against the type. */
const sceneShape = SCENE_ACTIVE satisfies SceneRead;

/** CodexEntryRead — re-checks the shared fixture against the type. */
const codexShape = FAROSZ_CODEX[0] satisfies CodexEntryRead;

/**
 * SeriesRead — pins the Feature #3a series contract: a project-scoped grouping
 * with id/title/order + timestamps. If the backend renames/drops a field and the
 * FE type follows, this fixture stops satisfying `SeriesRead` → a `tsc` error.
 */
const seriesShape = FAROSZ_SERIES satisfies SeriesRead;

/**
 * BookRead — pins the Feature #3a `series_id` slot (a book may belong to a
 * series within its project, or `null`). The Fárosz book is assigned to a
 * series so the field is exercised with a real value.
 */
const bookShape = FAROSZ_BOOK satisfies BookRead;

/** ProviderRead — re-checks the shared fixture (masked key only) vs the type. */
const providerShape = PROVIDER_GEMINI satisfies ProviderRead;

/**
 * ProjectRead — pins the Feature #1 card-aggregate contract: `book_count` +
 * `word_count` are integers alongside the base project fields. If the backend
 * renames/drops either and the FE type follows, this fixture stops satisfying
 * `ProjectRead` → a `tsc` error.
 */
const projectShape = FAROSZ_PROJECT satisfies ProjectRead;

/** RevisionRead — minimal typed literal (no standalone fixture is exported). */
const revisionShape = {
  id: "rev-rewrite-1",
  scene_id: "5ce33333-3333-3333-3333-333333333333",
  job_id: "job-rewrite-1",
  content: "Szelene meg sem rezzent.",
  approved: false,
  revision_type: "rewrite",
  model_name: "ollama/llama3.2",
  prompt_version: "1.0",
  created_at: "2026-06-14T16:00:00Z",
  updated_at: "2026-06-14T16:00:00Z",
} satisfies RevisionRead;

/** GenerationJobRead — minimal typed literal (no standalone fixture exported). */
const jobShape = {
  id: "job-rewrite-0",
  scene_id: "5ce33333-3333-3333-3333-333333333333",
  chapter_id: null,
  job_type: "rewrite",
  status: "done",
  model_name: "ollama/llama3.2",
  prompt_version: "1.0",
  input_data: {},
  output_data: {},
  error_message: null,
  created_at: "2026-06-14T16:00:00Z",
  updated_at: "2026-06-14T16:00:00Z",
} satisfies GenerationJobRead;

/**
 * AIResult — pins the B2c RAG-context contract: `context_entities` is a list of
 * `{id, label, entity_type}` (all strings). If the backend renames/drops this
 * field and the FE type follows, this literal stops satisfying `AIResult` → a
 * `tsc` error; the runtime assertion below documents the field's JS shape.
 */
const aiResultShape = {
  revision: revisionShape,
  job: jobShape,
  context_entities: [
    { id: "codex-szelene", label: "Szelene", entity_type: "character" },
  ],
} satisfies AIResult;

describe("FE↔BE contract drift-guard (interim)", () => {
  it("SceneRead: load-bearing fields exist with the expected JS types", () => {
    expect(typeof sceneShape.id).toBe("string");
    expect(typeof sceneShape.chapter_id).toBe("string");
    expect(typeof sceneShape.created_at).toBe("string");
    expect(typeof sceneShape.updated_at).toBe("string");
    expect(typeof sceneShape.word_count).toBe("number");
    // enum-ish discriminator on the wire.
    expect(typeof sceneShape.status).toBe("string");
    // nullable FK is present (null is a valid value, but the key must exist).
    expect("pov_character_id" in sceneShape).toBe(true);
  });

  it("ProjectRead: id/timestamps are strings, book_count + word_count are numbers", () => {
    expect(typeof projectShape.id).toBe("string");
    expect(typeof projectShape.created_at).toBe("string");
    expect(typeof projectShape.updated_at).toBe("string");
    expect(typeof projectShape.book_count).toBe("number");
    expect(typeof projectShape.word_count).toBe("number");
  });

  it("RevisionRead: id/timestamps are strings, approved is a boolean", () => {
    expect(typeof revisionShape.id).toBe("string");
    expect(typeof revisionShape.created_at).toBe("string");
    expect(typeof revisionShape.updated_at).toBe("string");
    expect(typeof revisionShape.approved).toBe("boolean");
    expect(typeof revisionShape.revision_type).toBe("string");
  });

  it("CodexEntryRead: id/timestamps are strings, ai_visible is boolean, arrays are arrays, series_id slot present", () => {
    expect(typeof codexShape.id).toBe("string");
    expect(typeof codexShape.created_at).toBe("string");
    expect(typeof codexShape.updated_at).toBe("string");
    expect(typeof codexShape.ai_visible).toBe("boolean");
    expect(typeof codexShape.entry_type).toBe("string");
    expect(Array.isArray(codexShape.aliases)).toBe(true);
    expect(Array.isArray(codexShape.tags)).toBe(true);
    // Feature #3a scope slot: present (null = project-global, string = a series).
    expect("series_id" in codexShape).toBe(true);
  });

  it("SeriesRead: id/timestamps/title are strings, order_index is a number", () => {
    expect(typeof seriesShape.id).toBe("string");
    expect(typeof seriesShape.project_id).toBe("string");
    expect(typeof seriesShape.title).toBe("string");
    expect(typeof seriesShape.order_index).toBe("number");
    expect(typeof seriesShape.created_at).toBe("string");
    expect(typeof seriesShape.updated_at).toBe("string");
    // description is nullable, but the key must exist on the wire.
    expect("description" in seriesShape).toBe(true);
  });

  it("BookRead: carries a series_id slot (a series id or null)", () => {
    expect(typeof bookShape.id).toBe("string");
    expect(typeof bookShape.project_id).toBe("string");
    // Feature #3a: the book→series link. The key must exist (null is valid).
    expect("series_id" in bookShape).toBe(true);
  });

  it("ProviderRead: id/timestamps are strings, has_key is boolean, NEVER carries a raw key", () => {
    expect(typeof providerShape.id).toBe("string");
    expect(typeof providerShape.created_at).toBe("string");
    expect(typeof providerShape.updated_at).toBe("string");
    expect(typeof providerShape.has_key).toBe("boolean");
    expect(typeof providerShape.type).toBe("string");
    expect(typeof providerShape.enabled).toBe("boolean");
    // SECURITY contract: the wire shape exposes only a masked preview, never a
    // raw `api_key` field.
    expect("api_key" in providerShape).toBe(false);
  });

  it("GenerationJobRead: id/timestamps are strings, status is a string discriminator", () => {
    expect(typeof jobShape.id).toBe("string");
    expect(typeof jobShape.created_at).toBe("string");
    expect(typeof jobShape.updated_at).toBe("string");
    expect(typeof jobShape.status).toBe("string");
    expect(typeof jobShape.job_type).toBe("string");
  });

  it("AIResult: carries a context_entities list of {id,label,entity_type} strings", () => {
    // The B2c contract slot: RAG entities the AI grounded on. The key must
    // exist (an empty array is valid — RAG skipped — but the field is present).
    expect("context_entities" in aiResultShape).toBe(true);
    expect(Array.isArray(aiResultShape.context_entities)).toBe(true);
    const [entity] = aiResultShape.context_entities;
    expect(typeof entity.id).toBe("string");
    expect(typeof entity.label).toBe("string");
    expect(typeof entity.entity_type).toBe("string");
  });
});
