"use client";

/**
 * Profil screen (DESIGN-C — faithful to Alexandria.dc.html lines 956–987).
 *
 * The author profile: a gold-rule header, an identity card, a 3-up stat row and
 * a writer-settings card. The three stats bind REAL aggregates from
 * {@link useProjects} (total books, total words, total scenes — summed across
 * every project); while the query is loading or errored the numbers fall back to
 * an em dash so the screen never crashes. The identity (name / initials / handle)
 * binds the REAL authenticated user from {@link useMe} (GET /auth/me), falling
 * back to the static `hu.user` values while it loads or if it fails so the card
 * is never blank. Writer settings are display-only this pass; the "Szerkesztés"
 * button is an honest V1+ stub that toasts `profil.editSoon`.
 */
import { Cpu, Pencil } from "lucide-react";
import { Button, Icon, PageHero, toast } from "@/components/kit";
import { useMe, useProjects } from "@/lib/api/hooks";
import { hu } from "@/lib/i18n/hu";

/** Em dash shown while the aggregates load or after a fetch error. */
const DASH = "—";

export function ProfileScreen() {
  const projectsQuery = useProjects();
  const meQuery = useMe();

  // Real aggregates — summed across every project. While loading or on error we
  // show the em dash rather than a misleading "0" (and never throw).
  const ready = projectsQuery.isSuccess && projectsQuery.data !== undefined;
  const projects = ready ? projectsQuery.data : undefined;

  const totalBooks = projects
    ? projects.reduce((sum, p) => sum + p.book_count, 0)
    : null;
  const totalWords = projects
    ? projects.reduce((sum, p) => sum + p.word_count, 0)
    : null;
  const totalScenes = projects
    ? projects.reduce((sum, p) => sum + p.scene_count, 0)
    : null;

  // Real identity from /me, with a graceful fall back to the static i18n values
  // while the query loads or if it fails — so the card is never blank.
  const me = meQuery.data;
  const displayName = me?.display_name ?? hu.user.name;
  const initials = me?.initials ?? hu.user.initials;
  const handle = me ? `@${me.username}` : hu.profil.handle;

  const stats: { value: string; label: string }[] = [
    {
      value: totalBooks === null ? DASH : String(totalBooks),
      label: hu.profil.statBooks,
    },
    {
      value: totalWords === null ? DASH : totalWords.toLocaleString("hu-HU"),
      label: hu.profil.statWords,
    },
    {
      value: totalScenes === null ? DASH : String(totalScenes),
      label: hu.profil.statScenes,
    },
  ];

  return (
    <div
      data-screen-label="Profil"
      className="min-h-0 flex-1 overflow-y-auto px-10 pb-20 pt-11"
      style={{
        background:
          "radial-gradient(120% 50% at 50% -12%, var(--gold-soft) 0%, transparent 46%)",
      }}
    >
      <div className="mx-auto max-w-[720px]">
        <PageHero
          eyebrow={hu.profil.eyebrow}
          title={hu.profil.title}
          className="mb-6"
        />

        {/* Identity card */}
        <div className="mb-4 flex items-center gap-[18px] rounded-2xl border border-border bg-surface p-[22px_24px] shadow-card">
          <span className="flex h-[74px] w-[74px] flex-none items-center justify-center rounded-full bg-pov2-bg font-display text-[30px] font-semibold text-pov2-tx shadow-card">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[26px] font-semibold text-text">
              {displayName}
            </div>
            <div className="mt-0.5 text-[13px] text-text-muted">
              {`${handle} · ${hu.profil.workspace} · ${hu.profil.role}`}
            </div>
          </div>
          <Button
            variant="secondary"
            size={34}
            leadingIcon={<Icon icon={Pencil} size={14} />}
            onClick={() => toast.info(hu.profil.editSoon)}
          >
            {hu.profil.edit}
          </Button>
        </div>

        {/* Stat row — real aggregates from useProjects() */}
        <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-[14px] border border-border bg-surface p-[18px] shadow-card"
            >
              <div className="font-display text-[30px] font-semibold tabular-nums text-text">
                {s.value}
              </div>
              <div className="mt-0.5 text-[12px] text-text-muted">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Writer settings — display-only this pass */}
        <div>
          <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.07em] text-text-muted">
            {hu.profil.settingsLabel}
          </span>
          <div className="rounded-[14px] border border-border bg-surface px-4 py-1.5 shadow-card">
            <SettingRow
              label={hu.profil.addressingLabel}
              sub={hu.profil.addressingSub}
              value={
                <span className="text-[13px] font-semibold text-text">
                  {hu.profil.addressingValue}
                </span>
              }
            />
            <SettingRow
              label={hu.profil.modelLabel}
              sub={hu.profil.modelSub}
              value={
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ai-text">
                  <Icon icon={Cpu} size={13} />
                  {hu.profil.modelValue}
                </span>
              }
            />
            <SettingRow
              label={hu.profil.goalLabel}
              sub={hu.profil.goalSub}
              last
              value={
                <span className="text-[13px] font-semibold tabular-nums text-text">
                  {hu.profil.goalValue}
                </span>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A single divider-separated writer-settings row (label + sublabel / value). */
function SettingRow({
  label,
  sub,
  value,
  last,
}: {
  label: string;
  sub: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-3.5 py-[13px]" +
        (last ? "" : " border-b border-border")
      }
    >
      <span className="flex-1">
        <span className="block text-[13.5px] font-medium text-text">
          {label}
        </span>
        <span className="block text-[11.5px] text-text-muted">{sub}</span>
      </span>
      {value}
    </div>
  );
}
