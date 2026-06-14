"use client";

/**
 * 300px Codex list sidebar — mounted by the AppShell on the `codex` route.
 *
 * Layout (faithful to the prototype showcodex nav, Alexandria App.dc.html ~330):
 *   book header (cover + title + author) · underline tabs (Codex / Snippetek /
 *   Chatek) · search + filter · scope toggle (Ez a könyv / Sorozat) · "+ Új"
 *   dashed button (opens the New-Codex modal) · grouped entry list by type.
 *
 * Codex is PROJECT-scoped but the route only carries `bookId`, so the owning
 * project id is resolved via the M5 `useBookProjectId` resolver (reused, not
 * rebuilt). Selecting an entry writes the `?entry` query param (shared with the
 * detail page via {@link useCodexSelection}). Loading / empty / error states are
 * surfaced honestly.
 */
import { useMemo, useState } from "react";
import { Filter, Library, Plus, Search } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { BookSpineCard } from "@/components/kit/book-spine-card";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { bookIdFromPathname } from "@/lib/use-shell-chrome";
import { usePathname } from "next/navigation";
import { useBookProjectId } from "@/lib/api/ai-hooks";
import { useBookTree, useCodexEntries } from "@/lib/api/hooks";
import { countMentions, decodeTags, mentionNeedles } from "@/lib/api/codex";
import type { CodexEntryRead } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { CodexEntryAvatar, entryTypeOrder } from "@/components/codex/codex-meta";
import { useCodexSelection } from "@/components/codex/use-codex-selection";
import { NewCodexModal } from "@/components/codex/new-codex-modal";

type SidebarTab = "codex" | "snippets" | "chats";

/** A group of entries sharing an entry type, ready to render as a section. */
interface EntryGroup {
  type: string;
  label: string;
  entries: CodexEntryRead[];
}

/** Group + order entries by type for the sectioned list. */
function groupEntries(entries: CodexEntryRead[]): EntryGroup[] {
  const byType = new Map<string, CodexEntryRead[]>();
  for (const entry of entries) {
    const list = byType.get(entry.entry_type) ?? [];
    list.push(entry);
    byType.set(entry.entry_type, list);
  }
  return [...byType.entries()]
    .sort((a, b) => entryTypeOrder(a[0]) - entryTypeOrder(b[0]))
    .map(([type, list]) => ({
      type,
      label: hu.codex.typeGroupLabel[type] ?? type,
      entries: [...list].sort((a, b) => a.title.localeCompare(b.title, "hu")),
    }));
}

export function CodexSidebar() {
  const pathname = usePathname();
  const bookId = bookIdFromPathname(pathname ?? "/") ?? undefined;
  const projectIdQuery = useBookProjectId(bookId);
  const projectId = projectIdQuery.data;
  const codex = useCodexEntries(projectId);
  const tree = useBookTree(bookId);
  const { selectedId, select } = useCodexSelection();

  const [tab, setTab] = useState<SidebarTab>("codex");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const entries = useMemo(() => codex.data ?? [], [codex.data]);

  // Real manuscript mention counts per entry, in ONE pass over the cached book
  // tree (MVP corpus). Same scan as the detail header, so the sidebar number is
  // truthful — not the alias count it used to show under a "megemlítés" label.
  const mentionsById = useMemo(() => {
    const out = new Map<string, number>();
    for (const entry of entries) {
      const { aliases } = decodeTags(entry.tags);
      const needles = mentionNeedles(entry.title, aliases);
      out.set(entry.id, countMentions(tree.chapters, needles));
    }
    return out;
  }, [entries, tree.chapters]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? entries.filter((e) => {
          const { aliases } = decodeTags(e.tags);
          return (
            e.title.toLowerCase().includes(needle) ||
            aliases.some((a) => a.toLowerCase().includes(needle))
          );
        })
      : entries;
    return groupEntries(filtered);
  }, [entries, query]);

  const isError = codex.isError || projectIdQuery.isError;
  const isLoading = projectIdQuery.isLoading || codex.isLoading;

  return (
    <nav
      aria-label={hu.codex.sidebarAria}
      className="flex w-codex-sidebar flex-none flex-col border-r border-border bg-bg-subtle"
    >
      {/* Book header */}
      <div className="flex items-center gap-[11px] border-b border-border p-3.5">
        <BookSpineCard size="sm" glyph="star" title={hu.project.demoTitle} />
        <div className="min-w-0">
          <p className="m-0 truncate text-[14px] font-semibold text-text">
            {hu.project.demoTitle}
          </p>
          <p className="m-0 mt-0.5 text-[12px] text-text-muted">
            {hu.project.author}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={hu.codex.sidebarAria}
        className="flex border-b border-border px-2"
      >
        {(
          [
            ["codex", hu.codex.tabCodex],
            ["snippets", hu.codex.tabSnippets],
            ["chats", hu.codex.tabChats],
          ] as [SidebarTab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "h-[38px] border-b-2 px-3 text-[13px]",
              tab === value
                ? "border-accent font-semibold text-text"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + filter + Új */}
      <div className="flex gap-1.5 border-b border-border p-2.5">
        <div className="flex h-8 flex-1 items-center gap-[7px] rounded-lg border border-border bg-surface px-2.5 text-text-faint focus-within:border-accent">
          <Icon icon={Search} size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={hu.codex.searchPlaceholder}
            aria-label={hu.codex.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
          />
        </div>
        <button
          type="button"
          aria-label={hu.codex.filterAria}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-muted"
        >
          <Icon icon={Filter} size={14} />
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-8 flex-none items-center gap-[5px] rounded-lg border border-dashed border-accent bg-transparent px-2.5 text-[12px] font-semibold text-accent-text hover:bg-accent-muted"
        >
          <Icon icon={Plus} size={13} />
          {hu.codex.addNew}
        </button>
      </div>

      {/* Scope toggle. Only "Ez a könyv" is active in the MVP; "Sorozat" is a
          V1 placeholder (disabled), so there is no scope STATE to track yet. */}
      <div className="flex flex-none items-center gap-1 border-b border-border bg-surface-soft px-2.5 py-1.5">
        <button
          type="button"
          aria-pressed
          className="h-7 flex-1 rounded-[7px] border border-accent bg-accent-muted text-[12px] font-semibold text-accent-text"
        >
          {hu.codex.scopeBook}
        </button>
        <button
          type="button"
          disabled
          title={hu.codex.scopeSeriesDisabledTitle}
          className="flex h-7 flex-1 items-center justify-center gap-[5px] rounded-[7px] border border-border bg-transparent text-[12px] text-text-faint opacity-60"
        >
          <Icon icon={Library} size={12} />
          {hu.codex.scopeSeries}
        </button>
      </div>

      {/* List */}
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {tab !== "codex" ? (
          <p className="m-auto px-4 py-8 text-center text-[12px] text-text-muted">
            {tab === "snippets"
              ? hu.codex.snippetsEmpty
              : hu.codex.chatsEmpty}
          </p>
        ) : isError ? (
          <p
            role="alert"
            className="m-auto px-4 py-8 text-center text-[12px] text-danger-text"
          >
            {(codex.error ?? projectIdQuery.error)?.message ??
              hu.codex.listError}
          </p>
        ) : isLoading ? (
          <div className="m-auto flex items-center gap-2 py-8 text-[12px] text-text-muted">
            <Spinner size={14} />
            {hu.codex.listLoading}
          </div>
        ) : entries.length === 0 ? (
          <div className="m-auto flex max-w-[220px] flex-col items-center gap-2.5 px-4 py-8 text-center">
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-2xl bg-accent-muted text-accent-text">
              <BrandStar size={24} />
            </span>
            <p className="m-0 text-[14px] font-semibold text-text">
              {hu.codex.listEmptyTitle}
            </p>
            <p className="m-0 text-[12px] leading-[1.5] text-text-muted">
              {hu.codex.listEmptyHint}
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-0.5 flex h-8 items-center gap-1.5 rounded-lg bg-accent-strong px-3 text-[13px] font-semibold text-accent-fg hover:bg-accent-hover"
            >
              <Icon icon={Plus} size={13} />
              {hu.codex.listEmptyCta}
            </button>
          </div>
        ) : groups.length === 0 ? (
          <p className="m-auto px-4 py-8 text-center text-[12px] text-text-muted">
            {hu.codex.listEmptyHint}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.type} className="contents">
              <p className="m-0 mb-1 mt-2.5 px-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted first:mt-0.5">
                {hu.codex.groupHeading(group.label, group.entries.length)}
              </p>
              {group.entries.map((entry) => {
                const { aliases } = decodeTags(entry.tags);
                const description =
                  entry.content?.trim() ||
                  (aliases.length > 0 ? aliases.join(", ") : "");
                const mentions = mentionsById.get(entry.id) ?? 0;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={selectedId === entry.id}
                    onClick={() => select(entry.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[10px] border border-transparent p-2 text-left hover:bg-surface-muted",
                      selectedId === entry.id &&
                        "border-accent bg-accent-muted",
                    )}
                  >
                    <CodexEntryAvatar
                      entryType={entry.entry_type}
                      name={entry.title}
                      size={30}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-text">
                        {entry.title}
                      </span>
                      {description ? (
                        <span className="block truncate text-[11px] text-text-muted">
                          {description}
                        </span>
                      ) : null}
                    </span>
                    {mentions > 0 ? (
                      <span className="ml-auto flex-none text-[11px] tabular-nums text-accent-text">
                        {mentions}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <NewCodexModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        projectId={projectId}
        onCreated={(id) => select(id)}
      />
    </nav>
  );
}
