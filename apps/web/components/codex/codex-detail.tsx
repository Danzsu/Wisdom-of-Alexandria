"use client";

/**
 * Codex entry detail — the prototype "Codex — Karakter Detail" screen
 * (Alexandria App.dc.html ~line 941). Header (type pill, editable name, role
 * pill, portrait stub, mention count, Kitűzés, delete) + six tabs.
 *
 * MVP tabs (real, persisted):
 *   - Részletek: aliases chips + AI-suggest stub, description, story role →
 *     saved via the update mutation to the dedicated `aliases` / `role` columns
 *     (P1.4 — no more `tags` codec; see lib/api/codex.ts)
 *   - Megemlítések: scenes whose content contains the name / an alias (best-
 *     effort scan over the book's scene tree)
 *   - Nyomon követés: name-tracking checkbox (UI-only — the backend has no field
 *     for it; the real AI gate is `ai_visible`), AI-context radios, and the
 *     `ai_visible` spoiler toggle → ai_visible persists via the update mutation.
 *
 * V1 placeholders (honest empty states, no faked engine):
 *   - Kutatás (AI Q&A / RAG), Kapcsolatok (relations), Progresszió.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Pin,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/kit/alert-dialog";
import { FieldLabel } from "@/components/kit/form-input";
import { Textarea } from "@/components/kit/textarea";
import { CheckboxRow } from "@/components/kit/checkbox-row";
import { RadioGroup, RadioRow } from "@/components/kit/radio-group";
import { Icon } from "@/components/kit/icon";
import { BrandStar } from "@/components/kit/brand-star";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import {
  contentMentions,
  countMentions,
  mentionNeedles,
  parseAliasInput,
} from "@/lib/api/codex";
import {
  useBookTree,
  useDeleteCodexEntry,
  useUpdateCodexEntry,
} from "@/lib/api/hooks";
import type { BookTreeResult } from "@/lib/api/hooks";
import type { CodexEntryRead } from "@/lib/api/types";
import { cn, countWords } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { CodexEntryAvatar } from "./codex-meta";

type DetailTab =
  | "details"
  | "research"
  | "relations"
  | "progress"
  | "mentions"
  | "tracking";

const DETAIL_TABS: [DetailTab, string][] = [
  ["details", hu.codex.tabDetails],
  ["research", hu.codex.tabResearch],
  ["relations", hu.codex.tabRelations],
  ["progress", hu.codex.tabProgress],
  ["mentions", hu.codex.tabMentions],
  ["tracking", hu.codex.tabTracking],
];

export interface CodexDetailProps {
  entry: CodexEntryRead;
  projectId: string;
  bookId: string | undefined;
  /** Fired after a successful delete so the screen can clear the selection. */
  onDeleted: () => void;
}

export function CodexDetail({
  entry,
  projectId,
  bookId,
  onDeleted,
}: CodexDetailProps) {
  const [tab, setTab] = useState<DetailTab>("details");

  // Reset to the default tab when a different entry is selected.
  useEffect(() => {
    setTab("details");
  }, [entry.id]);

  // Single manuscript scan, shared by the header count + the Megemlítések tab,
  // so "N megemlítés" means real scene mentions everywhere (NOT the alias count).
  const tree = useBookTree(bookId);
  const needles = useMemo(
    () => mentionNeedles(entry.title, entry.aliases),
    [entry.title, entry.aliases],
  );
  const mentionCount = useMemo(
    () => countMentions(tree.chapters, needles),
    [tree.chapters, needles],
  );

  const update = useUpdateCodexEntry();
  const del = useDeleteCodexEntry();
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** Patch helper shared by every save path; surfaces errors via toast. */
  function patch(
    body: Parameters<typeof update.mutate>[0]["patch"],
    onOk?: () => void,
  ) {
    update.mutate(
      { projectId, entryId: entry.id, patch: body },
      {
        onSuccess: () => onOk?.(),
        onError: (error) => toast.error(`${hu.codex.saveError}: ${error.message}`),
      },
    );
  }

  function handleDelete() {
    del.mutate(
      { projectId, entryId: entry.id },
      {
        onSuccess: () => {
          toast.success(hu.codex.deleted);
          onDeleted();
        },
        onError: (error) =>
          toast.error(`${hu.codex.deleteError}: ${error.message}`),
      },
    );
  }

  return (
    <div
      data-screen-label={hu.codex.detailScreenLabel}
      className="min-h-0 flex-1 overflow-y-auto p-8"
    >
      <div className="mx-auto max-w-[720px]">
        <DetailHeader
          entry={entry}
          mentionCount={mentionCount}
          saving={update.isPending}
          onRename={(title) => patch({ title })}
          onDelete={() => setConfirmOpen(true)}
        />

        {/* Tabs */}
        <div
          role="tablist"
          aria-label={hu.codex.detailTabsAria}
          className="my-[18px] mt-5 flex gap-0.5 overflow-x-auto border-b border-border"
        >
          {DETAIL_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "h-9 flex-none whitespace-nowrap border-b-2 px-3 text-[13px]",
                tab === value
                  ? "border-accent font-semibold text-text"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "details" ? (
          <DetailsTab entry={entry} onPatch={patch} />
        ) : tab === "mentions" ? (
          <MentionsTab tree={tree} needles={needles} />
        ) : tab === "tracking" ? (
          <TrackingTab entry={entry} onPatch={patch} />
        ) : tab === "research" ? (
          <V1Placeholder
            title={hu.codex.researchV1Title}
            hint={hu.codex.researchV1Hint}
          />
        ) : tab === "relations" ? (
          <V1Placeholder
            title={hu.codex.relationsV1Title}
            hint={hu.codex.relationsV1Hint}
          />
        ) : (
          <V1Placeholder
            title={hu.codex.progressV1Title}
            hint={hu.codex.progressV1Hint}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={hu.codex.deleteTitle}
        description={hu.codex.deleteDescription(entry.title)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function DetailHeader({
  entry,
  mentionCount,
  saving,
  onRename,
  onDelete,
}: {
  entry: CodexEntryRead;
  mentionCount: number;
  saving: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(entry.title);
  useEffect(() => setName(entry.title), [entry.title]);

  function commitName() {
    const next = name.trim();
    if (next && next !== entry.title) onRename(next);
    else setName(entry.title);
  }

  const typeLabel = hu.codex.typeLabel[entry.entry_type] ?? entry.entry_type;

  return (
    <div className="flex items-start gap-5">
      <div className="min-w-0 flex-1">
        {/* Type pill (read-only dropdown affordance for V1) */}
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-border bg-surface px-[9px] text-[12px] text-text-muted">
          <Icon icon={UserRound} size={12} />
          {typeLabel}
          <Icon icon={ChevronDown} size={10} />
        </span>

        {/* Editable name */}
        <input
          aria-label={hu.codex.nameAria}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="my-1.5 mb-1.5 w-full border-none bg-transparent text-[26px] font-bold text-text outline-none"
        />

        <div className="flex items-center gap-1.5">
          {entry.role ? (
            <span className="flex h-5 items-center rounded-full bg-pov2-bg px-[9px] text-[11px] font-semibold text-pov2-tx">
              {entry.role}
            </span>
          ) : null}
          {entry.tags.map((label) => (
            <span
              key={label}
              className="flex h-5 items-center rounded-full bg-surface-muted px-[9px] text-[11px] text-text-soft"
            >
              {label}
            </span>
          ))}
          <span className="flex h-5 items-center rounded-full px-[7px] text-[11px] text-text-muted">
            {hu.codex.addTag}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        {/* Portrait dropzone — STUB (toast only, no upload) */}
        <button
          type="button"
          aria-label={hu.codex.portraitAria}
          title={hu.codex.portraitTitle}
          onClick={() => toast.info(hu.codex.portraitStubToast)}
          className="flex h-[84px] w-[84px] flex-col items-center justify-center gap-[3px] rounded-xl border-2 border-dashed border-border-strong bg-surface-muted text-text-faint hover:border-accent hover:bg-accent-muted hover:text-accent-text"
        >
          <CodexEntryAvatar
            entryType={entry.entry_type}
            name={entry.title}
            size={34}
          />
          <span className="text-[10px] font-semibold">
            {hu.codex.portraitLabel}
          </span>
        </button>
        <span className="text-[12px] tabular-nums text-accent-text">
          {hu.codex.mentionCount(mentionCount)}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toast.info(hu.codex.pinStubToast)}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-[11px] text-[12px] text-text-soft hover:border-accent hover:bg-accent-muted hover:text-accent-text"
          >
            <Icon icon={Pin} size={13} />
            {hu.codex.pin}
          </button>
          <button
            type="button"
            aria-label={hu.codex.deleteAria}
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:border-danger hover:bg-danger-muted hover:text-danger-text"
          >
            <Icon icon={Trash2} size={13} />
          </button>
        </div>
        {saving ? (
          <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <Spinner size={12} />
            {hu.codex.saving}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Részletek tab                                                              */
/* -------------------------------------------------------------------------- */

function DetailsTab({
  entry,
  onPatch,
}: {
  entry: CodexEntryRead;
  onPatch: (patch: {
    aliases?: string[];
    role?: string | null;
    content?: string | null;
  }) => void;
}) {
  const [aliasInput, setAliasInput] = useState("");
  const [description, setDescription] = useState(entry.content ?? "");
  useEffect(() => setDescription(entry.content ?? ""), [entry.content]);

  /** Persist a new alias set to the dedicated `aliases` column. */
  function commitAliases(aliases: string[]) {
    onPatch({ aliases });
  }

  function addAliases() {
    const additions = parseAliasInput(aliasInput);
    if (additions.length === 0) return;
    const merged = [...entry.aliases];
    for (const alias of additions) {
      if (!merged.some((a) => a.toLowerCase() === alias.toLowerCase())) {
        merged.push(alias);
      }
    }
    commitAliases(merged);
    setAliasInput("");
  }

  function removeAlias(alias: string) {
    commitAliases(entry.aliases.filter((a) => a !== alias));
  }

  function commitDescription() {
    const next = description.trim();
    const current = entry.content ?? "";
    if (next !== current.trim()) onPatch({ content: next ? next : null });
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Aliases */}
      <div>
        <FieldLabel hint={<BrandStar size={13} variant="sparkle" />}>
          {hu.codex.aliasesLabel}
        </FieldLabel>
        <p className="m-0 mb-[7px] text-[12px] text-text-muted">
          {hu.codex.aliasesHint}
        </p>
        {entry.aliases.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {entry.aliases.map((alias) => (
              <span
                key={alias}
                className="flex h-6 items-center gap-1.5 rounded-full bg-surface-muted px-2.5 text-[12px] text-text-soft"
              >
                {alias}
                <button
                  type="button"
                  aria-label={hu.codex.aliasRemoveAria(alias)}
                  onClick={() => removeAlias(alias)}
                  className="text-text-faint hover:text-danger-text"
                >
                  <Icon icon={X} size={11} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          type="text"
          value={aliasInput}
          onChange={(e) => setAliasInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAliases();
            }
          }}
          onBlur={addAliases}
          placeholder={hu.codex.aliasesPlaceholder}
          aria-label={hu.codex.aliasesLabel}
          className="box-border h-9 w-full rounded-[10px] border border-border bg-surface px-3 text-[13px] text-text outline-none placeholder:text-text-faint focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]"
        />
        <div className="mt-[7px] flex items-center gap-1.5">
          <span className="text-[11px] text-text-muted">
            {hu.codex.aliasesSuggestLabel}
          </span>
          <button
            type="button"
            aria-label={hu.codex.aliasesSuggestAria}
            onClick={() => toast.info(hu.codex.aliasSuggestStubToast)}
            className="flex h-5 items-center gap-1 rounded-full bg-surface-muted px-2 text-[11px] text-text-soft hover:bg-accent-muted hover:text-accent-text"
          >
            <BrandStar size={11} variant="sparkle" />
            {hu.codex.tabResearch}
          </button>
        </div>
      </div>

      {/* Description */}
      <div>
        <FieldLabel
          htmlFor="codex-desc"
          hint={<BrandStar size={13} variant="sparkle" />}
        >
          {hu.codex.descriptionLabel}
        </FieldLabel>
        <Textarea
          id="codex-desc"
          rows={5}
          minHeight={120}
          variant="manuscript"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
        />
        <div className="mt-1.5 flex items-center gap-2.5 text-[12px] text-text-muted">
          <span className="tabular-nums">
            {hu.codex.descriptionWordCount(countWords(description))}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            aria-label={hu.codex.descriptionSuggestAria}
            onClick={() => toast.info(hu.codex.descriptionSuggestStubToast)}
            className="flex items-center gap-1 text-[12px] text-text-muted hover:text-accent-text"
          >
            <BrandStar size={12} variant="sparkle" />
            {hu.codex.tabResearch}
          </button>
        </div>
      </div>

      {/* Story role */}
      <RoleField role={entry.role} onPatch={onPatch} />

      <button
        type="button"
        onClick={() => toast.info(hu.codex.addDetail)}
        className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-text-muted hover:text-accent-text"
      >
        <Icon icon={Pin} size={13} className="rotate-45" />
        {hu.codex.addDetail}
      </button>
    </div>
  );
}

/** Story-role field — the dedicated `role` column, edited inline and persisted. */
function RoleField({
  role: roleValue,
  onPatch,
}: {
  role: string | null;
  onPatch: (patch: { role?: string | null }) => void;
}) {
  const [role, setRole] = useState(roleValue ?? "");
  useEffect(() => setRole(roleValue ?? ""), [roleValue]);

  function commitRole() {
    const next = role.trim();
    if (next !== (roleValue ?? "")) {
      onPatch({ role: next || null });
    }
  }

  return (
    <div>
      <FieldLabel htmlFor="codex-role">{hu.codex.roleLabel}</FieldLabel>
      <input
        id="codex-role"
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onBlur={commitRole}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder={hu.codex.rolePlaceholder}
        className="box-border h-9 w-full max-w-[280px] rounded-[10px] border border-border bg-surface px-3 text-[13px] text-text outline-none placeholder:text-text-faint focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Megemlítések tab                                                           */
/* -------------------------------------------------------------------------- */

function MentionsTab({
  tree,
  needles,
}: {
  tree: BookTreeResult;
  needles: string[];
}) {
  const matches = useMemo(() => {
    const out: { chapterTitle: string; sceneTitle: string; snippet: string }[] =
      [];
    for (const chapter of tree.chapters) {
      for (const scene of chapter.scenes) {
        if (contentMentions(scene.content, needles)) {
          out.push({
            chapterTitle: chapter.title,
            sceneTitle: scene.title,
            snippet: (scene.content ?? "").trim().slice(0, 160),
          });
        }
      }
    }
    return out;
  }, [tree.chapters, needles]);

  if (tree.isError) {
    return (
      <p role="alert" className="m-0 text-[13px] text-danger-text">
        {tree.error?.message ?? hu.codex.listError}
      </p>
    );
  }
  if (tree.isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-text-muted">
        <Spinner size={14} />
        {hu.codex.mentionsLoading}
      </div>
    );
  }
  if (matches.length === 0) {
    return (
      <p className="m-0 text-[13px] text-text-muted">{hu.codex.mentionsEmpty}</p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {matches.map((m, i) => (
        <div
          key={`${m.chapterTitle}-${m.sceneTitle}-${i}`}
          className="flex flex-col gap-1 rounded-[10px] px-3 py-2.5 hover:bg-surface-muted"
        >
          <span className="text-[12px] font-semibold text-text">
            {hu.codex.mentionsScene(m.chapterTitle, m.sceneTitle)}
          </span>
          <span className="font-serif text-[13px] italic text-text-soft">
            {m.snippet}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Nyomon követés tab                                                         */
/* -------------------------------------------------------------------------- */

function TrackingTab({
  entry,
  onPatch,
}: {
  entry: CodexEntryRead;
  onPatch: (patch: { ai_visible?: boolean }) => void;
}) {
  // Name-tracking is a UI-only preference: the backend has no field for it (the
  // recognition scan is title+aliases based, and the real AI gate is the
  // `ai_visible` column below). It is local component state, reset per entry.
  const [tracking, setTracking] = useState(true);
  useEffect(() => setTracking(true), [entry.id]);

  return (
    <div className="flex max-w-[480px] flex-col gap-4">
      <CheckboxRow
        label={hu.codex.trackingByName}
        checked={tracking}
        onCheckedChange={(next) => setTracking(next === true)}
      />

      <div className="border-t border-border pt-3.5">
        <p className="m-0 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {hu.codex.trackingAiContextLabel}
        </p>
        {/* AI-context preference — captured in the UI; the persisted gate is the
            ai_visible toggle below. The radio reflects intent for V1. */}
        <RadioGroup defaultValue="recognized" aria-label={hu.codex.trackingAiContextLabel}>
          <RadioRow
            value="always"
            label={hu.codex.trackingAlways}
            subText={hu.codex.trackingAlwaysHint}
          />
          <RadioRow
            value="recognized"
            label={
              <span className="flex items-center gap-1.5">
                {hu.codex.trackingWhenRecognized}
                <span className="flex h-[18px] items-center rounded-full bg-surface-muted px-[7px] text-[10px] font-semibold text-text-muted">
                  {hu.codex.trackingDefaultTag}
                </span>
              </span>
            }
          />
        </RadioGroup>
      </div>

      <div className="border-t border-border pt-3.5">
        <CheckboxRow
          // The ai_visible toggle is INVERTED: checking "hidden" sets
          // ai_visible=false (the entry is hidden from AI context — spoiler
          // protection). This persists via the update mutation.
          label={
            <span className="flex items-center gap-1.5">
              {hu.codex.trackingHidden}
              <span className="text-[12px] text-text-muted">
                {hu.codex.trackingHiddenHint}
              </span>
            </span>
          }
          checked={!entry.ai_visible}
          onCheckedChange={(next) => onPatch({ ai_visible: next !== true })}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* V1 placeholder                                                             */
/* -------------------------------------------------------------------------- */

function V1Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-surface-soft px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ai-muted text-ai-text">
        <BrandStar size={22} variant="sparkle" />
      </span>
      <p className="m-0 text-[14px] font-semibold text-text">{title}</p>
      <p className="m-0 max-w-[360px] text-[13px] leading-[1.5] text-text-muted">
        {hint}
      </p>
    </div>
  );
}
