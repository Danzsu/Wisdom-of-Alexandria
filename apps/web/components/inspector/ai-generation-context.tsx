"use client";

/**
 * AI generation coordinator — the shared bridge between the editor (selection
 * bubble menu, action grid, slash menu) and the AI Inspector that renders the
 * result. Provided once by the AppShell so it spans both the manuscript `<main>`
 * and the inspector `<aside>` (different subtrees, one provider).
 *
 * The human-in-the-loop contract lives here:
 *   trigger(action) → mutation runs → result held as a pending Revision
 *   accept()        → approveRevision (POST) → applySuggestion into the editor
 *   reject()        → discard, nothing inserted, nothing approved
 *
 * NOTHING is inserted into the manuscript before `accept()`. The pending result
 * is a Revision the backend already persisted with `approved: false`; accept is
 * the explicit approval + the only insert path.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useEditorStore, type SelectionSnapshot } from "@/lib/stores/editor-store";
import {
  useApproveRevision,
  useBookProjectId,
  useCreateSnippet,
  useGenerateScene,
  useModels,
  useRewrite,
  useWriteContinue,
} from "@/lib/api/ai-hooks";
import type { ContextEntity } from "@/components/kit/context-chips";

/** The single-revision AI actions surfaced in the action grid / bubble menu. */
export type AiActionKind =
  | "rewrite"
  | "expand"
  | "compress"
  | "dialog"
  | "fix"
  | "continue"
  | "generate";

/** Instruction text the backend `rewrite` prompt expects for each grid action. */
const ACTION_INSTRUCTION: Record<Exclude<AiActionKind, "continue" | "generate">, string> = {
  rewrite: "Írd át a kijelölt szöveget, megőrizve a jelentését és a stílusát.",
  expand: "Bővítsd ki a kijelölt szöveget több részlettel és érzékletességgel.",
  compress: "Tömörítsd a kijelölt szöveget, megtartva a lényeget.",
  dialog: "Alakítsd át a kijelölt szöveget élő, természetes párbeszéddé.",
  fix: "Javítsd a kijelölt szöveg nyelvtanát, központozását és gördülékenységét.",
};

/** A result awaiting the user's Accept / Reject decision (a pending Revision). */
export interface PendingResult {
  /** Which action produced it (drives the result-card label). */
  action: AiActionKind;
  /** The revision id to approve on Accept. */
  revisionId: string;
  /** The generated text. */
  content: string;
  /** Model name + prompt version from the revision (shown on the card). */
  model: string;
  version: string;
  /** Context entities that fed the generation (shown as ContextChips). */
  contextEntities: ContextEntity[];
  /**
   * The selection range to replace on Accept (rewrite-family actions). `null`
   * for generate/continue, which insert at the cursor instead of replacing.
   */
  range: { from: number; to: number } | null;
}

interface AiGenerationContextValue {
  /** True while any generation mutation is in flight. */
  isGenerating: boolean;
  /**
   * True while the approve (Elfogad) POST is in flight. Used to disable Accept +
   * Star so a double-click can't fire two approve POSTs / two inserts.
   */
  isAccepting: boolean;
  /** The current generation error (null when none). */
  error: Error | null;
  /** The result awaiting accept/reject (null when none). */
  pending: PendingResult | null;
  /**
   * Trigger a single-revision action using the current editor selection. An
   * optional `customInstruction` overrides the default instruction for the
   * rewrite-family actions (the AI tab's "Egyéni utasítás" field).
   */
  trigger: (action: AiActionKind, customInstruction?: string) => void;
  /** Approve the pending revision, then insert the approved text. */
  accept: () => void;
  /** Discard the pending result (nothing inserted, nothing approved). */
  reject: () => void;
  /** Copy the pending result text to the clipboard. */
  copy: () => void;
  /** Save the pending result as a Snippet (POST). */
  star: () => void;
}

const AiGenerationContext = createContext<AiGenerationContextValue | null>(null);

/** Access the AI generation coordinator. Throws outside the provider. */
export function useAiGeneration(): AiGenerationContextValue {
  const ctx = useContext(AiGenerationContext);
  if (!ctx) {
    throw new Error("useAiGeneration must be used within <AiGenerationProvider>");
  }
  return ctx;
}

export function AiGenerationProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const params = useParams<{ bookId?: string; sceneId?: string }>();
  const bookId = params?.bookId;
  const sceneId = params?.sceneId;

  const storeModel = useEditorStore((s) => s.activeModel);

  const models = useModels();
  // The chosen model (config-driven) falls back to the backend default. Never a
  // hardcoded literal — both sources come from the /ai/models list.
  const activeModel = storeModel ?? models.data?.default;

  const rewriteMutation = useRewrite();
  const continueMutation = useWriteContinue();
  const generateMutation = useGenerateScene();
  const approveMutation = useApproveRevision();
  const snippetMutation = useCreateSnippet();
  const projectIdQuery = useBookProjectId(bookId);

  const [pending, setPending] = useState<PendingResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const isGenerating =
    rewriteMutation.isPending ||
    continueMutation.isPending ||
    generateMutation.isPending;

  // Retrieved RAG context (Codex entities that fed the generation) is M6/M10.
  // The backend does not return it yet, so the chip row shows only the model
  // chip for now; the contract slot (contextEntities) is kept for when RAG lands.
  const contextEntities: ContextEntity[] = useMemo(() => [], []);

  const trigger = useCallback(
    (action: AiActionKind, customInstruction?: string) => {
      setError(null);
      setPending(null);

      // Read the FRESH selection straight from the store at call time. Editor-seam
      // actions (bubble / toolbar / slash) call captureSelection() — which writes
      // the new snapshot synchronously — immediately before trigger(); a closure
      // over the rendered `aiSelection` would still hold the PREVIOUS render's
      // value (null on first action, or the prior range on later ones), so the
      // no-selection guard and the range used by applySuggestion would both be
      // stale. getState() always returns the just-written snapshot.
      const selection: SelectionSnapshot | null =
        useEditorStore.getState().aiSelection;
      const model = activeModel;

      const handleSingle = (
        revisionId: string,
        content: string,
        revModel: string | null,
        version: string | null,
        range: { from: number; to: number } | null,
      ) => {
        setPending({
          action,
          revisionId,
          content,
          model: revModel ?? model ?? hu.inspector.metaUnknown,
          version: version ?? "",
          contextEntities,
          range,
        });
      };

      if (action === "continue") {
        // Continue uses the whole scene text (the editor's current content).
        const sceneText = selection?.text ?? "";
        continueMutation.mutate(
          {
            scene_text: sceneText,
            scene_id: sceneId ?? null,
            model,
          },
          {
            onSuccess: (res) =>
              handleSingle(
                res.revision.id,
                res.revision.content,
                res.revision.model_name,
                res.revision.prompt_version,
                null,
              ),
            onError: (e) => setError(e),
          },
        );
        return;
      }

      if (action === "generate") {
        // Generate-from-beats with the selection as the single beat.
        const beat = selection?.text?.trim();
        generateMutation.mutate(
          {
            beats: [beat && beat.length > 0 ? beat : hu.write.beatDefaultBeat],
            scene_id: sceneId ?? null,
            model,
          },
          {
            onSuccess: (res) =>
              handleSingle(
                res.revision.id,
                res.revision.content,
                res.revision.model_name,
                res.revision.prompt_version,
                null,
              ),
            onError: (e) => setError(e),
          },
        );
        return;
      }

      // Rewrite-family actions require a selection.
      if (!selection || selection.text.trim().length === 0) {
        toast(hu.write.toastNoSelection);
        return;
      }
      const instruction =
        customInstruction && customInstruction.trim().length > 0
          ? customInstruction.trim()
          : ACTION_INSTRUCTION[action];
      rewriteMutation.mutate(
        {
          selected_text: selection.text,
          instruction,
          scene_id: sceneId ?? null,
          model,
        },
        {
          onSuccess: (res) =>
            handleSingle(
              res.revision.id,
              res.revision.content,
              res.revision.model_name,
              res.revision.prompt_version,
              { from: selection.from, to: selection.to },
            ),
          onError: (e) => setError(e),
        },
      );
    },
    [
      activeModel,
      sceneId,
      rewriteMutation,
      continueMutation,
      generateMutation,
      contextEntities,
    ],
  );

  const accept = useCallback(() => {
    if (!pending) return;
    // Guard re-entry: a second click while the approve POST is still in flight
    // would otherwise fire a second /approve and a second insert.
    if (approveMutation.isPending) return;
    const result = pending;
    // Human-in-the-loop: APPROVE the revision (POST), then — and only then —
    // insert the approved text into the manuscript via the editor's bridge.
    approveMutation.mutate(result.revisionId, {
      onSuccess: () => {
        const insert = useEditorStore.getState().applySuggestion;
        if (insert) insert(result.content, result.range);
        setPending(null);
        toast(hu.write.toastRevisionSaved);
      },
      onError: (e) => setError(e),
    });
  }, [pending, approveMutation]);

  const reject = useCallback(() => {
    // Discard only — nothing inserted, nothing approved (the unapproved revision
    // simply stays unapproved on the backend).
    setPending(null);
    setError(null);
    toast(hu.write.toastResultRejected);
  }, []);

  const copy = useCallback(() => {
    if (!pending) return;
    void navigator.clipboard
      .writeText(pending.content)
      .then(() => toast(hu.write.toastCopied))
      .catch((e: unknown) => {
        const message =
          e instanceof Error ? e.message : "Vágólap-hiba";
        toast(message);
      });
  }, [pending]);

  const star = useCallback(() => {
    if (!pending) return;
    const projectId = projectIdQuery.data;
    if (!projectId) {
      // The project id is still resolving or failed — surface, never silently
      // drop the star action.
      toast(
        projectIdQuery.error?.message ?? hu.projects.openProjectError,
      );
      return;
    }
    snippetMutation.mutate(
      {
        projectId,
        data: {
          title: hu.inspector.resultLabel[pending.action] ?? hu.inspector.tabAi,
          content: pending.content,
          source_scene_id: sceneId ?? null,
          tags: [],
        },
      },
      {
        onSuccess: () => toast(hu.write.toastSnippetSaved),
        onError: (e) => toast(e.message),
      },
    );
  }, [pending, projectIdQuery.data, projectIdQuery.error, snippetMutation, sceneId]);

  const value = useMemo<AiGenerationContextValue>(
    () => ({
      isGenerating,
      isAccepting: approveMutation.isPending,
      error,
      pending,
      trigger,
      accept,
      reject,
      copy,
      star,
    }),
    [
      isGenerating,
      approveMutation.isPending,
      error,
      pending,
      trigger,
      accept,
      reject,
      copy,
      star,
    ],
  );

  return (
    <AiGenerationContext.Provider value={value}>
      {children}
    </AiGenerationContext.Provider>
  );
}
