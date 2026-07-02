/**
 * Canned instruction text for the rewrite-family quick actions.
 *
 * These strings are sent as the `instruction` field to `POST /ai/rewrite` when
 * the user fires a grid/bubble action without typing a custom instruction. They
 * are AI-facing, so per CLAUDE.md they live OUTSIDE the React component (a
 * single typed catalog) rather than inline in JSX — centralized so the wording
 * can evolve in one place. (The fully backend-owned form — sending an action key
 * and resolving the prompt from `packages/prompts/hu` — is the longer-term home;
 * this catalog is the pragmatic frontend step.)
 */

/** The selection-based quick actions (each replaces the selection on accept). */
export type RewriteActionKind =
  | "rewrite"
  | "expand"
  | "compress"
  | "dialog"
  | "fix";

/**
 * The subset that still rides `POST /ai/rewrite` with a canned instruction.
 * `expand` / `compress` moved to their DEDICATED endpoints (`/ai/expand`,
 * `/ai/compress`) — the backend owns those prompts, so they carry no
 * instruction here (an optional user `guidance` rides in the body instead).
 */
export type InstructionActionKind = "rewrite" | "dialog" | "fix";

/** Instruction text the backend `rewrite` prompt expects for each action. */
export const ACTION_INSTRUCTION: Record<InstructionActionKind, string> = {
  rewrite: "Írd át a kijelölt szöveget, megőrizve a jelentését és a stílusát.",
  dialog: "Alakítsd át a kijelölt szöveget élő, természetes párbeszéddé.",
  fix: "Javítsd a kijelölt szöveg nyelvtanát, központozását és gördülékenységét.",
};
