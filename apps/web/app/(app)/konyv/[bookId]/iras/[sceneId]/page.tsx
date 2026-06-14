"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import {
  AiToolbar,
  CleanWriteBar,
  ManuscriptEditor,
  StoryTimelineRail,
  scenesToTimeline,
  type ToolbarAction,
  type BubbleAction,
  type SlashMenuCallbacks,
} from "@/components/editor";
import { useAutosave } from "@/components/editor";
import {
  useBookTree,
  findSceneLocation,
  type ChapterWithScenes,
} from "@/lib/api/hooks";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useNavTo } from "@/lib/use-nav-to";
import { routes } from "@/lib/routes";
import { countWords } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";

/**
 * Write View (the hero screen). Loads the book's chapter/scene tree, resolves the
 * active scene (the route only carries bookId + sceneId), mounts the manuscript
 * editor with its toolbar / clean-write bar / timeline rail, and wires autosave.
 *
 * AI generation (rewrite/describe/scene-from-beat) and the AI Inspector are M5:
 * every AI action here routes to a stub toast. Codex CRUD + the real codex
 * popover data are M6. Image/audio/table editing are V2 stubs.
 */
export default function IrasPage() {
  const params = useParams<{ bookId: string; sceneId: string }>();
  const bookId = params?.bookId;
  const sceneId = params?.sceneId;

  const tree = useBookTree(bookId);
  const navTo = useNavTo();

  const aiFreeOn = useEditorStore((s) => s.aiFreeOn);
  const setWordCount = useEditorStore((s) => s.setWordCount);
  const setBeatState = useEditorStore((s) => s.setBeatState);
  const resetForScene = useEditorStore((s) => s.resetForScene);

  const [editor, setEditor] = useState<Editor | null>(null);

  const location = useMemo(
    () =>
      sceneId && tree.chapters.length > 0
        ? findSceneLocation(tree.chapters, sceneId)
        : null,
    [tree.chapters, sceneId],
  );

  const chapterId = location?.chapter.id;
  const { scheduleSave } = useAutosave({ chapterId, sceneId });

  // Reset transient editor signals whenever the active scene changes.
  useEffect(() => {
    resetForScene();
  }, [sceneId, resetForScene]);

  const handleChange = useCallback(
    (content: string, wordCount: number) => {
      setWordCount(wordCount);
      scheduleSave(content);
    },
    [setWordCount, scheduleSave],
  );

  /* ---- Stub action handlers (M5 = AI generation; M6 = codex) ---- */
  const stubM5 = useCallback(() => toast(hu.write.toastM5), []);

  const handleToolbarAction = useCallback(
    (action: ToolbarAction) => {
      switch (action) {
        case "beat":
          setBeatState("config");
          editor?.chain().focus().insertBeatCard().run();
          break;
        case "continue":
        case "rewrite":
        case "describe":
          stubM5();
          break;
        case "brainstorm":
          if (bookId) navTo(routes.book(bookId, "chat"));
          break;
        case "codex-progression":
          if (bookId) navTo(routes.book(bookId, "codex"));
          break;
        case "scene-chat":
          if (bookId) navTo(routes.book(bookId, "chat"));
          break;
        case "comment":
          toast(hu.write.toastComment);
          break;
        case "insert-image":
          toast(hu.write.toastImageInserted);
          break;
        case "insert-table":
          toast(hu.write.toastTableInserted);
          break;
        case "version-history":
        case "history":
          toast(hu.write.toastHistory);
          break;
        case "thesaurus":
          toast(hu.write.toastThesaurus);
          break;
        case "visualization":
          toast(hu.write.toastVisualization);
          break;
        case "scene-summarize":
          toast(hu.write.toastSummarize);
          break;
        case "scene-detect":
          toast(hu.write.toastDetect);
          break;
        case "scene-subtitle":
          toast(hu.write.toastSubtitle);
          break;
        case "scene-duplicate":
          toast(hu.write.toastDuplicate);
          break;
        case "scene-export":
          toast(hu.write.toastExportScene);
          break;
        default:
          break;
      }
    },
    [editor, bookId, navTo, stubM5, setBeatState],
  );

  const handleBubbleAction = useCallback(
    (action: BubbleAction) => {
      if (action === "codex") {
        toast(hu.write.toastCodexAdd);
      } else if (action === "audio") {
        toast(hu.write.toastAudioPrototype);
      } else {
        // rewrite / describe / expand / visualize / ai → M5
        stubM5();
      }
    },
    [stubM5],
  );

  const handleOpenCodex = useCallback(() => {
    if (bookId) navTo(routes.book(bookId, "codex"));
  }, [bookId, navTo]);

  const slashCallbacks: SlashMenuCallbacks = useMemo(
    () => ({
      onBeat: (ed) => {
        setBeatState("config");
        ed.chain().focus().insertBeatCard().run();
      },
      onContinue: () => stubM5(),
      onCodexProgression: () => {
        if (bookId) navTo(routes.book(bookId, "codex"));
      },
    }),
    [bookId, navTo, stubM5, setBeatState],
  );

  /* ---- Loading / error / not-found states (never swallow the error) ---- */
  if (tree.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-text-muted">
        <Spinner size={16} />
        {hu.write.sceneLoading}
      </div>
    );
  }

  if (tree.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="m-0 text-[14px] font-semibold text-danger-text">
          {hu.write.sceneError}
        </p>
        <p className="m-0 max-w-md text-[13px] text-text-muted">
          {tree.error?.message}
        </p>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-text-muted">
        {hu.write.sceneNotFound}
      </div>
    );
  }

  return (
    <WriteViewBody
      scene={location.scene}
      chapter={location.chapter}
      allScenes={tree.chapters}
      activeSceneId={sceneId}
      aiFreeOn={aiFreeOn}
      editor={editor}
      onEditorReady={setEditor}
      onChange={handleChange}
      onToolbarAction={handleToolbarAction}
      onBubbleAction={handleBubbleAction}
      onOpenCodex={handleOpenCodex}
      slashCallbacks={slashCallbacks}
      onTimelineSelect={(id) => bookId && navTo(routes.scene(bookId, id))}
      onBeatGenerate={stubM5}
    />
  );
}

interface WriteViewBodyProps {
  scene: { id: string; title: string; content: string | null };
  chapter: ChapterWithScenes;
  allScenes: ChapterWithScenes[];
  activeSceneId: string | undefined;
  aiFreeOn: boolean;
  editor: Editor | null;
  onEditorReady: (editor: Editor | null) => void;
  onChange: (content: string, wordCount: number) => void;
  onToolbarAction: (action: ToolbarAction) => void;
  onBubbleAction: (action: BubbleAction) => void;
  onOpenCodex: (codexId: string) => void;
  slashCallbacks: SlashMenuCallbacks;
  onTimelineSelect: (sceneId: string) => void;
  onBeatGenerate: () => void;
}

/** The mounted Write View once the active scene is resolved. */
function WriteViewBody({
  scene,
  chapter,
  allScenes,
  activeSceneId,
  aiFreeOn,
  editor,
  onEditorReady,
  onChange,
  onToolbarAction,
  onBubbleAction,
  onOpenCodex,
  slashCallbacks,
  onTimelineSelect,
  onBeatGenerate,
}: WriteViewBodyProps) {
  const flatScenes = useMemo(
    () => allScenes.flatMap((c) => c.scenes),
    [allScenes],
  );
  const timelineScenes = useMemo(
    () => scenesToTimeline(flatScenes),
    [flatScenes],
  );

  // Seed the initial word count from the persisted scene content.
  const setWordCount = useEditorStore((s) => s.setWordCount);
  useEffect(() => {
    setWordCount(countWords(scene.content ?? ""));
  }, [scene.id, scene.content, setWordCount]);

  // Focus mode hides the timeline rail too (the toolbar stays so the Fókusz
  // toggle remains reachable to exit; AppShell hides the surrounding chrome).
  const focusOn = useEditorStore((s) => s.focusOn);

  const kicker = chapter.title.toUpperCase();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {aiFreeOn ? (
        <CleanWriteBar editor={editor} />
      ) : (
        <AiToolbar editor={editor} onAction={onToolbarAction} />
      )}

      <div className="flex min-h-0 flex-1">
        <ManuscriptEditor
          key={scene.id}
          sceneId={scene.id}
          initialContent={scene.content}
          kicker={kicker}
          title={chapter.title}
          subtitle={scene.title}
          onChange={onChange}
          onEditorReady={onEditorReady}
          onOpenCodex={onOpenCodex}
          onBubbleAction={onBubbleAction}
          onBeatGenerate={onBeatGenerate}
          onBeatApply={() => toast(hu.write.toastBeatApplied)}
          onBeatDiscard={() => toast(hu.write.toastBeatDiscarded)}
          onImageUpload={() => toast(hu.write.toastImagePlaceholder)}
          onAudioActivate={() => toast(hu.write.toastAudioPrototype)}
          onTableAction={() => toast(hu.write.toastTableInserted)}
          slashCallbacks={slashCallbacks}
        />

        {!aiFreeOn && !focusOn ? (
          <StoryTimelineRail
            scenes={timelineScenes}
            activeSceneId={activeSceneId}
            onSelect={onTimelineSelect}
          />
        ) : null}
      </div>
    </div>
  );
}
