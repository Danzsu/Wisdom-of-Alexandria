"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { ChevronDown, Download, Music, Play } from "lucide-react";
import { Button } from "@/components/kit/button";
import { Icon } from "@/components/kit/icon";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { TypedRadioGroup } from "@/components/kit/radio-group";
import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { toast } from "@/components/kit/toast";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
  MenuSection,
} from "@/components/kit/popover-menu";
import { Spinner } from "@/components/kit/spinner";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { markdownFilename } from "@/lib/slugify";
import { useExportMarkdown } from "@/lib/api/export-hooks";
import { useBookTree, type ChapterWithScenes } from "@/lib/api/hooks";
import type { ExportScope } from "@/lib/api/exports";
import { ExportFormatGrid, type ExportFormat } from "./export-format-grid";

export interface ExportTabProps {
  bookId: string;
  /** Resolved book title (drives the book-scope filename + the radio label). */
  title: string;
}

/**
 * The EXPORT tab body: format grid + scope radios + (for chapter/scene scope) a
 * target picker + filename preview + the V2 audio accordion + the real Markdown
 * export button. Markdown export is fully wired for ALL three scopes (whole
 * book / a chosen chapter / a chosen scene); the non-Markdown formats remain
 * honest stubs.
 */
export function ExportTab({ bookId, title }: ExportTabProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [scope, setScope] = useState<ExportScope>("book");
  const [chapterTargetId, setChapterTargetId] = useState<string | null>(null);
  const [sceneTargetId, setSceneTargetId] = useState<string | null>(null);
  const [audioOpen, setAudioOpen] = useState(false);

  const exportMutation = useExportMarkdown();
  const tree = useBookTree(bookId);

  // Resolve the currently-selected target (for the filename preview + the
  // title we send for the client-side filename fallback).
  const selectedChapter = useMemo(
    () => tree.chapters.find((c) => c.id === chapterTargetId) ?? null,
    [tree.chapters, chapterTargetId],
  );
  const selectedScene = useMemo(() => {
    for (const chapter of tree.chapters) {
      const scene = chapter.scenes.find((s) => s.id === sceneTargetId);
      if (scene) return scene;
    }
    return null;
  }, [tree.chapters, sceneTargetId]);

  // The id + title that drive the export call and the filename, per scope.
  let targetId: string | undefined;
  let targetTitle = title;
  if (scope === "chapter") {
    targetId = chapterTargetId ?? undefined;
    targetTitle = selectedChapter?.title ?? title;
  } else if (scope === "scene") {
    targetId = sceneTargetId ?? undefined;
    targetTitle = selectedScene?.title ?? title;
  }

  const filename = markdownFilename(targetTitle);
  // For non-book scopes a target MUST be chosen before exporting.
  const needsTarget = scope !== "book";
  const exportDisabled =
    exportMutation.isPending || (needsTarget && !targetId);

  function handleExport() {
    if (format !== "markdown") {
      toast.info(hu.exportScreen.formatStubToast(formatDisplayName(format)));
      return;
    }
    if (needsTarget && !targetId) {
      // The button is disabled in this state; guard defensively.
      return;
    }
    exportMutation.mutate(
      { bookId, title: targetTitle, scope, targetId },
      {
        onSuccess: (result) => {
          toast.success(hu.exportScreen.exportSuccess(result.filename));
        },
        onError: (error) => {
          toast.error(hu.exportScreen.exportError, {
            description: error.message,
          });
        },
      },
    );
  }

  return (
    <div>
      <p className="mb-5 text-[13px] text-text-muted">{hu.exportScreen.intro}</p>

      <SectionEyebrow as="h3" className="mb-2">
        {hu.exportScreen.formatLabel}
      </SectionEyebrow>
      <div className="mb-6">
        <ExportFormatGrid selected={format} onSelect={setFormat} />
      </div>

      <SectionEyebrow as="h3" className="mb-2">
        {hu.exportScreen.scopeLabel}
      </SectionEyebrow>
      <div className={needsTarget ? "mb-3" : "mb-7"}>
        <TypedRadioGroup<ExportScope>
          aria-label={hu.exportScreen.scopeLabel}
          value={scope}
          onValueChange={setScope}
          options={[
            { value: "book", label: hu.exportScreen.scopeBook(title) },
            { value: "chapter", label: hu.exportScreen.scopeChapter },
            { value: "scene", label: hu.exportScreen.scopeScene },
          ]}
        />
      </div>

      {scope === "chapter" ? (
        <ChapterPicker
          tree={tree}
          value={chapterTargetId}
          onSelect={setChapterTargetId}
        />
      ) : null}
      {scope === "scene" ? (
        <ScenePicker
          tree={tree}
          value={sceneTargetId}
          onSelect={setSceneTargetId}
        />
      ) : null}

      <div className="mb-5 flex items-center gap-2 rounded-[10px] border border-border bg-surface-muted px-3 py-2.5">
        <span className="text-[11px] text-text-muted">
          {hu.exportScreen.filenameLabel}
        </span>
        <span className="font-mono text-[12px] text-text-soft">{filename}</span>
      </div>

      <SectionEyebrow as="h3" className="mb-2">
        {hu.exportScreen.audioLabel}
      </SectionEyebrow>
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <button
          type="button"
          aria-expanded={audioOpen}
          onClick={() => setAudioOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-muted"
        >
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-accent-muted text-accent-text">
            <Music size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-text">
              {hu.exportScreen.audioTitle}
            </span>
            <span className="mt-px block text-[12px] text-text-muted">
              {hu.exportScreen.audioHint}
            </span>
          </span>
          <ToggleSwitch
            aria-label={hu.exportScreen.audioToggleAria}
            checked={audioOpen}
            onCheckedChange={setAudioOpen}
          />
        </button>
        {audioOpen ? (
          <div className="flex flex-col gap-px border-t border-border p-1.5">
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-text-soft">
              <Play size={13} className="fill-accent text-accent" aria-hidden="true" />
              <span className="flex-1">{hu.exportScreen.audioRow1Title}</span>
              <span className="text-[11px] text-text-muted">
                {hu.exportScreen.audioRow1Meta}
              </span>
            </div>
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-text-soft">
              <Play size={13} className="fill-accent text-accent" aria-hidden="true" />
              <span className="flex-1">{hu.exportScreen.audioRow2Title}</span>
              <span className="text-[11px] text-text-muted">
                {hu.exportScreen.audioRow2Meta}
              </span>
            </div>
            <p className="mx-2.5 mb-1 mt-1.5 text-[11px] text-text-muted">
              {hu.exportScreen.audioFootnote}
            </p>
            <p className="mx-2.5 mb-1 text-[11px] text-warning-text">
              {hu.exportScreen.audioV2Note}
            </p>
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        variant="cta"
        className="h-10 w-full"
        disabled={exportDisabled}
        onClick={handleExport}
      >
        <Download size={15} aria-hidden="true" />
        {exportMutation.isPending
          ? hu.exportScreen.exporting
          : hu.exportScreen.exportCta}
      </Button>
      <p className="mt-2.5 text-center text-[11px] text-text-muted">
        {hu.exportScreen.backupNote}
      </p>
    </div>
  );
}

/** Shared trigger styling for the chapter / scene picker dropdowns. */
const PICKER_TRIGGER = cn(
  "inline-flex h-9 w-full cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-surface px-3 font-sans text-[13px] text-text-soft transition-colors",
  "hover:border-border-strong data-[state=open]:border-accent",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * Loading / error / empty state shared by both pickers. Returns the state node
 * to render, or `null` when the tree is ready and the picker dropdown should be
 * shown instead. Called as a plain function (not rendered as a component) so the
 * `null` "ready" result is a real null — not a truthy React element.
 */
function pickerState(
  tree: ReturnType<typeof useBookTree>,
  emptyText: string,
): ReactElement | null {
  if (tree.isLoading) {
    return (
      <div className="mb-5 flex items-center gap-2 text-[12px] text-text-muted">
        <Spinner size={14} />
        {hu.exportScreen.pickLoading}
      </div>
    );
  }
  if (tree.isError) {
    return (
      <div className="mb-5 text-[12px] text-danger-text" role="alert">
        {hu.exportScreen.pickError}
        {tree.error ? (
          <span className="mt-0.5 block text-text-muted">
            {tree.error.message}
          </span>
        ) : null}
      </div>
    );
  }
  if (tree.chapters.length === 0) {
    return <p className="mb-5 text-[12px] text-text-muted">{emptyText}</p>;
  }
  return null;
}

/** Dropdown to pick WHICH chapter to export (flat list of chapters). */
function ChapterPicker({
  tree,
  value,
  onSelect,
}: {
  tree: ReturnType<typeof useBookTree>;
  value: string | null;
  onSelect: (id: string) => void;
}) {
  const state = pickerState(tree, hu.exportScreen.pickChapterEmpty);
  if (state) return state;

  const selected = tree.chapters.find((c) => c.id === value) ?? null;
  return (
    <div className="mb-5">
      <PopoverMenu>
        <PopoverMenuTrigger
          aria-label={hu.exportScreen.pickChapterLabel}
          className={PICKER_TRIGGER}
        >
          <span className="flex-1 truncate text-left">
            {selected?.title ?? hu.exportScreen.pickPlaceholder}
          </span>
          <Icon icon={ChevronDown} size={12} />
        </PopoverMenuTrigger>
        <PopoverMenuContent
          align="start"
          className="max-h-[280px] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
        >
          {tree.chapters.map((chapter) => (
            <MenuRow key={chapter.id} onSelect={() => onSelect(chapter.id)}>
              {chapter.title}
            </MenuRow>
          ))}
        </PopoverMenuContent>
      </PopoverMenu>
    </div>
  );
}

/** Dropdown to pick WHICH scene to export (scenes grouped by their chapter). */
function ScenePicker({
  tree,
  value,
  onSelect,
}: {
  tree: ReturnType<typeof useBookTree>;
  value: string | null;
  onSelect: (id: string) => void;
}) {
  const state = pickerState(tree, hu.exportScreen.pickSceneEmpty);
  if (state) return state;

  const hasAnyScene = tree.chapters.some((c) => c.scenes.length > 0);
  if (!hasAnyScene) {
    return (
      <p className="mb-5 text-[12px] text-text-muted">
        {hu.exportScreen.pickSceneEmpty}
      </p>
    );
  }

  const selectedTitle = findSceneTitle(tree.chapters, value);
  return (
    <div className="mb-5">
      <PopoverMenu>
        <PopoverMenuTrigger
          aria-label={hu.exportScreen.pickSceneLabel}
          className={PICKER_TRIGGER}
        >
          <span className="flex-1 truncate text-left">
            {selectedTitle ?? hu.exportScreen.pickPlaceholder}
          </span>
          <Icon icon={ChevronDown} size={12} />
        </PopoverMenuTrigger>
        <PopoverMenuContent
          align="start"
          className="max-h-[280px] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
        >
          {tree.chapters
            .filter((chapter) => chapter.scenes.length > 0)
            .map((chapter) => (
              <div key={chapter.id} className="contents">
                <MenuSection
                  label={hu.exportScreen.sceneGroupPrefix(chapter.title)}
                />
                {chapter.scenes.map((scene) => (
                  <MenuRow key={scene.id} onSelect={() => onSelect(scene.id)}>
                    {scene.title}
                  </MenuRow>
                ))}
              </div>
            ))}
        </PopoverMenuContent>
      </PopoverMenu>
    </div>
  );
}

/** Resolve a scene's title within the loaded tree (for the picker trigger). */
function findSceneTitle(
  chapters: ChapterWithScenes[],
  sceneId: string | null,
): string | null {
  if (!sceneId) return null;
  for (const chapter of chapters) {
    const scene = chapter.scenes.find((s) => s.id === sceneId);
    if (scene) return scene.title;
  }
  return null;
}

/** Human-facing display name for a format (used in the stub toast). */
function formatDisplayName(format: ExportFormat): string {
  switch (format) {
    case "docx":
      return hu.exportScreen.fmtDocx;
    case "epub":
      return hu.exportScreen.fmtEpub;
    case "pdf":
      return hu.exportScreen.fmtPdf;
    case "txt":
      return hu.exportScreen.fmtTxt;
    default:
      return hu.exportScreen.fmtMarkdown;
  }
}
