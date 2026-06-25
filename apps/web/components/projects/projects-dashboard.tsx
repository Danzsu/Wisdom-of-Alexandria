"use client";

/**
 * Projektek dashboard — recreates the prototype `showprojects` screen and wires
 * the project lists to the real backend via {@link useProjects}. Handles
 * loading (Skeletons), empty (kit empty state) and error (inline retry) states.
 * The "Új könyv" / "Új projekt" affordances open the New-book wizard.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  Download,
  FileUp,
  Library,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  Button,
  Icon,
  MenuRow,
  PopoverMenu,
  PopoverMenuContent,
  PopoverMenuTrigger,
  SegmentedControl,
  Skeleton,
  toast,
  CelestialBackdrop,
} from "@/components/kit";
import { ErrorState } from "@/components/kit/error-state";
import { BrandStar } from "@/components/kit/brand-star";
import {
  useExportBackup,
  useProjects,
  useResolveFirstBookId,
} from "@/lib/api/hooks";
import type { ProjectRead } from "@/lib/api/types";
import { useNavTo } from "@/lib/use-nav-to";
import { useCalmMotion } from "@/lib/motion";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";
import { NewBookWizard } from "./new-book-wizard";
import { ImportDocxDialog } from "./import-docx-dialog";
import { RestoreBackupDialog } from "./restore-backup-dialog";

const ONBOARD_KEY = "woa-onboard-dismissed";
type SortKey = "recent" | "title";
type ViewKey = "grid" | "list";

export function ProjectsDashboard() {
  const navTo = useNavTo();
  const resolveFirstBookId = useResolveFirstBookId();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const projectsQuery = useProjects();
  const exportBackup = useExportBackup();

  /**
   * Download a project's JSON backup. Shows a progress toast, then surfaces
   * success or the server's error detail — never swallowed. The mutation is
   * read-only on the server so there is no cache to invalidate.
   */
  const onExportBackup = useCallback(
    (projectId: string) => {
      toast.info(hu.backup.exporting);
      exportBackup
        .mutateAsync(projectId)
        .then(() => toast.success(hu.backup.exportSuccess))
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          toast.error(`${hu.backup.exportError}: ${message}`);
        });
    },
    [exportBackup],
  );

  /**
   * Open a project at its real BOOK route. A project owns many books, so its own
   * id must never be threaded into the `[bookId]` segment — we resolve the
   * project's first book id and navigate to that book's plan view. If the project
   * has no book yet, or the lookup fails, we surface a toast (never swallow).
   */
  const openProject = useCallback(
    (projectId: string) => {
      resolveFirstBookId(projectId)
        .then((bookId) => {
          if (bookId) {
            navTo(routes.book(bookId, "terv"));
          } else {
            // M7: chapter/scene + first-book creation flow lands here; for now a
            // project with no book just tells the user there's nothing to open.
            toast.info(hu.projects.noBookInProject);
          }
        })
        .catch(() => toast.error(hu.projects.openProjectError));
    },
    [navTo, resolveFirstBookId],
  );

  return (
    <div
      data-screen-label="Projektek"
      className="min-h-0 flex-1 overflow-y-auto px-8 py-12"
      style={{
        background:
          "radial-gradient(120% 55% at 50% -10%, var(--accent-muted) 0%, transparent 46%)",
      }}
    >
      <div className="mx-auto max-w-[880px]">
        <OnboardingBanner onCreate={() => setWizardOpen(true)} />

        <WelcomeHero />

        <QuickActions
          onNewBook={() => setWizardOpen(true)}
          onImport={() => setImportOpen(true)}
          onRestore={() => setRestoreOpen(true)}
        />

        <DailySpark />

        <ContinueSection query={projectsQuery} onOpenProject={openProject} />

        <AllProjectsSection
          query={projectsQuery}
          onNewProject={() => setWizardOpen(true)}
          onOpenProject={openProject}
          onExportBackup={onExportBackup}
        />
      </div>

      <NewBookWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <ImportDocxDialog open={importOpen} onOpenChange={setImportOpen} />
      <RestoreBackupDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Onboarding banner (dismissable, persisted)                                 */
/* -------------------------------------------------------------------------- */

function OnboardingBanner({ onCreate }: { onCreate: () => void }) {
  // Default to hidden until we've read storage, so a dismissed banner never
  // flashes on mount.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(ONBOARD_KEY) === "1");
    } catch {
      // Storage unavailable — show the banner (default-visible behaviour).
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      // Persisting is best-effort; the in-session dismissal still applies.
    }
  }

  if (dismissed) return null;

  const steps = [
    { n: 1, title: hu.projects.onboardStep1Title, hint: hu.projects.onboardStep1Hint, primary: true, onClick: onCreate },
    { n: 2, title: hu.projects.onboardStep2Title, hint: hu.projects.onboardStep2Hint, primary: false, onClick: () => toast.info(hu.toast.comingSoon) },
    { n: 3, title: hu.projects.onboardStep3Title, hint: hu.projects.onboardStep3Hint, primary: false, onClick: () => toast.info(hu.toast.comingSoon) },
  ];

  return (
    <div
      className="relative mb-6 rounded-2xl border border-accent p-[18px_20px] shadow-panel [animation:woaReveal_.3s_cubic-bezier(.22,1,.36,1)]"
      style={{
        background: "linear-gradient(135deg,var(--accent-muted),var(--surface) 70%)",
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={hu.projects.onboardDismissAria}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <Icon icon={X} size={14} />
      </button>
      <p className="mb-[3px] text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
        {hu.projects.onboardEyebrow}
      </p>
      <p className="mb-4 font-serif text-[18px] font-semibold text-text">
        {hu.projects.onboardTitle}
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {steps.map((s) => (
          <button
            key={s.n}
            type="button"
            data-press=""
            onClick={s.onClick}
            className="flex flex-col gap-[7px] rounded-xl border border-border bg-surface p-[13px] text-left shadow-card transition-shadow hover:border-accent hover:shadow-panel"
          >
            <span className="flex items-center gap-[7px]">
              <span
                className={
                  "flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold " +
                  (s.primary
                    ? "bg-accent-strong text-accent-fg"
                    : "bg-surface-muted text-accent-text")
                }
              >
                {s.n}
              </span>
              <span className="text-[13px] font-semibold text-text">
                {s.title}
              </span>
            </span>
            <span className="text-[12px] leading-[1.45] text-text-muted">
              {s.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Welcome hero                                                               */
/* -------------------------------------------------------------------------- */

/** Book-spine SVG — the design's custom 50px icon (stroke, not filled). */
function BookSpineIcon({ size = 50 }: Readonly<{ size?: number }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      aria-hidden="true"
    >
      <path d="M3 7v13M21 7v13M3 7l4.5-3 4.5 3 4.5-3L21 7M3 11h18M3 15h18" />
    </svg>
  );
}

function WelcomeHero() {
  return (
    <div className="relative mb-1.5 flex flex-col items-center">
      {/* Ambient "quiet starlit shelf" star field — decorative, sits behind the
          radial glow + floating book-spine. Very faint, low density. */}
      <CelestialBackdrop
        density={16}
        opacity={0.55}
        className="-inset-x-8 -top-8"
      />

      {/* Floating gold book-spine icon */}
      <span
        aria-hidden="true"
        className="mb-4 block text-gold [animation:woaFloat_5s_ease-in-out_infinite]"
      >
        <BookSpineIcon size={50} />
      </span>

      {/* Eyebrow with flanking gold gradient lines */}
      <span className="mb-[14px] flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-px w-[34px]"
          style={{ background: "linear-gradient(90deg,transparent,var(--gold-line))" }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[.18em] text-gold-text">
          {hu.projects.heroEyebrow}
        </span>
        <span
          aria-hidden="true"
          className="h-px w-[34px]"
          style={{ background: "linear-gradient(90deg,var(--gold-line),transparent)" }}
        />
      </span>

      <h1 className="mb-0 text-center font-display text-[46px] font-semibold leading-[1.04] text-text">
        {hu.projects.heroTitle}
      </h1>
      <p className="mb-[26px] mt-2.5 text-center font-serif text-[16px] italic text-text-muted">
        {hu.projects.heroSubtitle}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quick-action grid                                                          */
/* -------------------------------------------------------------------------- */

function QuickActions({
  onNewBook,
  onImport,
  onRestore,
}: {
  onNewBook: () => void;
  onImport: () => void;
  onRestore: () => void;
}) {
  const actions: {
    key: string;
    icon: typeof Plus;
    label: string;
    primary: boolean;
    /** AI treatment on the icon chip (import — proto 1364). */
    ai?: boolean;
    onClick: () => void;
  }[] = [
    {
      key: "new",
      icon: Plus,
      label: hu.projects.quickNewBook,
      primary: true,
      onClick: onNewBook,
    },
    {
      key: "import",
      icon: FileUp,
      label: hu.projects.quickImport,
      primary: false,
      ai: true,
      onClick: onImport,
    },
    {
      key: "clean",
      icon: Wand2,
      label: hu.projects.quickCleanWrite,
      primary: false,
      onClick: () => toast.info(hu.projects.cleanWriteToast),
    },
    {
      key: "prompts",
      icon: Sparkles,
      label: hu.projects.quickPromptLibrary,
      primary: false,
      // The Prompt Library is global, but routes are book-scoped and there is no
      // book context on the dashboard — so we toast rather than navigate with a
      // fabricated "demo" book id. A real global Prompt Library route is future.
      onClick: () => toast.info(hu.projects.promptLibraryToast),
    },
    {
      key: "restore",
      icon: Upload,
      label: hu.backup.restoreAction,
      primary: false,
      onClick: onRestore,
    },
  ];

  return (
    <div className="woa-stagger mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          data-press=""
          onClick={a.onClick}
          className={
            "flex flex-col items-start gap-[9px] rounded-[14px] p-3.5 text-left transition-shadow " +
            (a.primary
              ? "border border-accent bg-accent-muted hover:shadow-panel"
              : "border border-border bg-surface shadow-card hover:border-border-strong hover:shadow-panel")
          }
        >
          <span
            className={
              "flex h-[34px] w-[34px] items-center justify-center rounded-[9px] " +
              (a.primary
                ? "bg-accent-strong text-accent-fg"
                : a.ai
                  ? "bg-ai-muted text-ai-text"
                  : "bg-surface-muted text-accent-text")
            }
          >
            <Icon icon={a.icon} size={17} />
          </span>
          <span
            className={
              "text-[13px] font-semibold " +
              (a.primary ? "text-accent-text" : "text-text")
            }
          >
            {a.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Daily spark CTA (V2, static)                                               */
/* -------------------------------------------------------------------------- */

function DailySpark() {
  return (
    <button
      type="button"
      onClick={() => toast.info(hu.projects.sparkToast)}
      className="mb-8 flex w-full items-center gap-[13px] rounded-[14px] border border-border border-l-[3px] border-l-gold bg-surface-soft p-[15px_18px] text-left transition-shadow hover:shadow-card"
    >
      <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-gold-soft text-gold-text">
        <BrandStar size={18} className="fill-current" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-gold-text">
          {hu.projects.sparkEyebrow}
        </span>
        <span className="mt-0.5 block font-serif text-[15.5px] italic text-text">
          {hu.projects.sparkPrompt}
        </span>
      </span>
      <span className="whitespace-nowrap text-[13px] font-semibold text-gold-text">
        {hu.projects.sparkCta}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading helper                                                     */
/* -------------------------------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Continue section — recent projects                                         */
/* -------------------------------------------------------------------------- */

function ContinueSection({
  query,
  onOpenProject,
}: {
  query: ReturnType<typeof useProjects>;
  onOpenProject: (projectId: string) => void;
}) {
  const recent = useMemo(() => {
    if (!query.data) return [];
    return [...query.data]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 2);
  }, [query.data]);

  if (query.isError) return null; // The error is surfaced once, in the All section.
  if (!query.isLoading && recent.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionLabel>{hu.projects.continueHeading}</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {query.isLoading
          ? [0, 1].map((i) => <RecentCardSkeleton key={i} />)
          : recent.map((p, i) => (
              <RecentCard
                key={p.id}
                project={p}
                variant={i % 2 === 0 ? "gold" : "blueGrey"}
                onClick={() => onOpenProject(p.id)}
              />
            ))}
      </div>
    </section>
  );
}

function RecentCard({
  project,
  variant,
  onClick,
}: {
  project: ProjectRead;
  variant: "gold" | "blueGrey";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-press=""
      onClick={onClick}
      className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5 text-left shadow-card transition-shadow hover:border-border-strong hover:shadow-panel"
    >
      <span
        className="flex h-14 w-10 flex-none items-end justify-center rounded-md border border-accent pb-1.5"
        style={{
          background:
            variant === "gold"
              ? "linear-gradient(150deg,var(--accent) 0%,#b8893f 55%,#8a6a2e 100%)"
              : "linear-gradient(150deg,#5b7a8c 0%,#42606f 60%,#2f4855 100%)",
          color: variant === "gold" ? "var(--accent-fg)" : "rgba(255,255,255,.85)",
          boxShadow:
            "inset 0 0 0 2px rgba(255,255,255,.12), inset 2px 0 0 rgba(0,0,0,.12)",
        }}
      >
        <Icon icon={BookOpen} size={16} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="block truncate text-[15px] font-semibold text-text">
          {project.title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-text-muted">
          {hu.user.name}
        </span>
      </span>
    </button>
  );
}

function RecentCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5 shadow-card">
      <Skeleton width={40} height={56} className="flex-none rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={11} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* All projects section — controls + grid/list + states                       */
/* -------------------------------------------------------------------------- */

function AllProjectsSection({
  query,
  onNewProject,
  onOpenProject,
  onExportBackup,
}: {
  query: ReturnType<typeof useProjects>;
  onNewProject: () => void;
  onOpenProject: (projectId: string) => void;
  onExportBackup: (projectId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewKey>("grid");
  const motionConf = useCalmMotion();

  const filtered = useMemo(() => {
    const data = query.data ?? [];
    const term = search.trim().toLowerCase();
    const matched = term
      ? data.filter((p) => p.title.toLowerCase().includes(term))
      : data;
    return [...matched].sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "hu")
        : b.updated_at.localeCompare(a.updated_at),
    );
  }, [query.data, search, sort]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="m-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {hu.projects.allHeading}
        </p>
        <label className="flex h-[30px] w-[180px] items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-text-faint focus-within:border-accent">
          <Icon icon={Search} size={13} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={hu.projects.searchPlaceholder}
            aria-label={hu.projects.searchPlaceholder}
            className="w-full bg-transparent text-[12px] text-text outline-none placeholder:text-text-faint"
          />
        </label>
        <SortDropdown value={sort} onChange={setSort} />
        <SegmentedControl<ViewKey>
          aria-label={`${hu.projects.viewGrid} / ${hu.projects.viewList}`}
          value={view}
          onValueChange={setView}
          options={[
            { value: "grid", label: hu.projects.viewGrid },
            { value: "list", label: hu.projects.viewList },
          ]}
        />
      </div>

      {query.isError ? (
        <ErrorState
          message={hu.projects.loadError}
          detail={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : query.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 && search.trim() === "" ? (
        <EmptyState onCreate={onNewProject} />
      ) : (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              : "flex flex-col gap-2"
          }
        >
          {filtered.map((p, i) => (
            // Short, capped mount fade-up per card (transform/opacity only),
            // replacing the no-op `woa-stagger` marker class with real, reduced-
            // motion-safe orchestration. The wrapper is itself the grid/flex item
            // (one child: the card), so layout is unchanged.
            <motion.div
              key={p.id}
              initial={{ opacity: 0, transform: "translateY(8px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{
                ...motionConf.transition,
                delay: motionConf.childDelay(i),
              }}
            >
              <ProjectCard
                project={p}
                variant={i % 2 === 0 ? "gold" : "blueGrey"}
                view={view}
                onClick={() => onOpenProject(p.id)}
                onExportBackup={() => onExportBackup(p.id)}
              />
            </motion.div>
          ))}
          {view === "grid" ? (
            <AddProjectTile onClick={onNewProject} />
          ) : null}
        </div>
      )}
    </section>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value === "title" ? hu.projects.sortTitle : hu.projects.sortRecent;
  return (
    <PopoverMenu open={open} onOpenChange={setOpen}>
      <PopoverMenuTrigger asChild>
        <button
          type="button"
          aria-label={hu.projects.sortLabel}
          className="flex h-[30px] items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[12px] text-text-muted transition-colors hover:border-border-strong"
        >
          {label}
          <Icon icon={ChevronDown} size={11} />
        </button>
      </PopoverMenuTrigger>
      <PopoverMenuContent align="end">
        <MenuRow onSelect={() => onChange("recent")}>
          {hu.projects.sortRecent}
        </MenuRow>
        <MenuRow onSelect={() => onChange("title")}>
          {hu.projects.sortTitle}
        </MenuRow>
      </PopoverMenuContent>
    </PopoverMenu>
  );
}

/**
 * Per-card actions menu (Feature #5). Rendered as a SIBLING of the card button
 * (not nested inside it — nesting interactive elements is invalid) and overlaid
 * in the top-right corner. Currently offers "Exportálás (JSON)"; more per-project
 * actions can land here later.
 */
function ProjectCardMenu({ onExportBackup }: { onExportBackup: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute right-2 top-2 z-10">
      <PopoverMenu open={open} onOpenChange={setOpen}>
        <PopoverMenuTrigger asChild>
          <button
            type="button"
            aria-label={hu.backup.menuAria}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface/80 text-text-muted shadow-card backdrop-blur transition-colors hover:bg-surface hover:text-text"
          >
            <Icon icon={MoreVertical} size={15} />
          </button>
        </PopoverMenuTrigger>
        <PopoverMenuContent align="end">
          <MenuRow onSelect={onExportBackup}>
            <span className="flex items-center gap-2">
              <Icon icon={Download} size={14} />
              {hu.backup.exportAction}
            </span>
          </MenuRow>
        </PopoverMenuContent>
      </PopoverMenu>
    </div>
  );
}

function ProjectCard({
  project,
  variant,
  view,
  onClick,
  onExportBackup,
}: {
  project: ProjectRead;
  variant: "gold" | "blueGrey";
  view: ViewKey;
  onClick: () => void;
  onExportBackup: () => void;
}) {
  const coverStyle = {
    background:
      variant === "gold"
        ? "linear-gradient(150deg,var(--accent) 0%,#b8893f 55%,#8a6a2e 100%)"
        : "linear-gradient(150deg,#5b7a8c 0%,#42606f 60%,#2f4855 100%)",
    color: variant === "gold" ? "var(--accent-fg)" : "rgba(255,255,255,.85)",
  };
  // Feature #1: the backend now carries per-project aggregates, so the card shows
  // real book + word counts ("{n} könyv · {formatted} szó"). The relative
  // last-updated date stays as a secondary detail line in the grid view.
  const counts = hu.projects.metaCounts(project.book_count, project.word_count);
  const meta = hu.projects.relativeUpdated(project.updated_at);

  if (view === "list") {
    return (
      <div className="relative">
        <button
          type="button"
          data-press=""
          onClick={onClick}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 pr-10 text-left shadow-card transition-shadow hover:border-border-strong hover:shadow-panel"
        >
          <span
            className="flex h-12 w-9 flex-none items-end justify-center rounded-md border border-accent pb-1"
            style={coverStyle}
          >
            <Icon icon={BookOpen} size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-text">
              {project.title}
            </span>
            <span className="block truncate text-[12px] text-text-muted">
              {project.description ?? ""}
            </span>
            <span className="mt-0.5 block truncate text-[11px] tabular-nums text-text-muted">
              {counts}
            </span>
          </span>
        </button>
        <ProjectCardMenu onExportBackup={onExportBackup} />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-press=""
        onClick={onClick}
        className="block w-full overflow-hidden rounded-[14px] border border-border bg-surface p-0 text-left shadow-card transition-shadow hover:border-border-strong hover:shadow-panel"
      >
        <span
          className="flex h-[88px] items-end justify-center border-b border-border pb-3"
          style={coverStyle}
        >
          <Icon icon={BookOpen} size={22} />
        </span>
        <span className="block p-3">
          <span className="block text-[14px] font-semibold text-text">
            {project.title}
          </span>
          {project.description ? (
            <span className="mt-0.5 block text-[12px] text-text-muted">
              {project.description}
            </span>
          ) : null}
          <span className="mt-2 block text-[11px] tabular-nums text-text-muted">
            {counts}
          </span>
          <span className="mt-0.5 block text-[11px] tabular-nums text-text-faint">
            {meta}
          </span>
        </span>
      </button>
      <ProjectCardMenu onExportBackup={onExportBackup} />
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-card">
      <Skeleton height={88} className="rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={11} />
        <Skeleton width="45%" height={11} className="mt-1.5" />
      </div>
    </div>
  );
}

function AddProjectTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-border-strong bg-transparent text-text-muted transition-colors hover:border-accent hover:bg-accent-muted hover:text-accent-text"
    >
      <Icon icon={Plus} size={24} />
      <span className="text-[13px] font-semibold">
        {hu.projects.addProjectTitle}
      </span>
      <span className="text-[11px]">{hu.projects.addProjectHint}</span>
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-border-strong bg-surface-soft px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted text-accent-text">
        <Icon icon={Library} size={24} />
      </span>
      <h2 className="m-0 font-serif text-[18px] font-semibold text-text">
        {hu.projects.emptyTitle}
      </h2>
      <p className="m-0 max-w-prose text-[13px] text-text-muted">
        {hu.projects.emptyHint}
      </p>
      <Button
        variant="cta"
        size={34}
        className="mt-1"
        leadingIcon={<Icon icon={Plus} size={15} />}
        onClick={onCreate}
      >
        {hu.projects.emptyCta}
      </Button>
    </div>
  );
}

