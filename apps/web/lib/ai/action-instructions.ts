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

/** The quick actions that carry a canned rewrite-family instruction. */
export type RewriteActionKind =
  | "rewrite"
  | "expand"
  | "compress"
  | "dialog"
  | "fix";

/** Instruction text the backend `rewrite` prompt expects for each action. */
export const ACTION_INSTRUCTION: Record<RewriteActionKind, string> = {
  rewrite: "Írd át a kijelölt szöveget, megőrizve a jelentését és a stílusát.",
  expand: "Bővítsd ki a kijelölt szöveget több részlettel és érzékletességgel.",
  compress: "Tömörítsd a kijelölt szöveget, megtartva a lényeget.",
  dialog: "Alakítsd át a kijelölt szöveget élő, természetes párbeszéddé.",
  fix: "Javítsd a kijelölt szöveg nyelvtanát, központozását és gördülékenységét.",
};
