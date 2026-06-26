"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { Badge, type BadgeProps } from "@/components/kit/badge";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useCheckContinuity } from "@/lib/api/ai-hooks";
import { asContinuitySeverity } from "@/lib/api/ai-types";
import type { ContinuityResult, ContinuityWarning } from "@/lib/api/ai-types";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

/**
 * Severity → badge variant + leading icon. An UNKNOWN severity (the wire schema
 * is a tolerant `z.string()`) falls back via {@link resolveSeverityKey}, so
 * malformed data renders rather than crashes.
 */
const SEVERITY_STYLE: Record<
  "info" | "warning" | "error",
  { variant: BadgeProps["variant"]; icon: LucideIcon }
> = {
  info: { variant: "accent", icon: Info },
  warning: { variant: "warning", icon: AlertTriangle },
  error: { variant: "danger", icon: CircleAlert },
};

/** Resolve a (possibly unknown) severity string to a known style key. */
function resolveSeverityKey(severity: string): "info" | "warning" | "error" {
  // An unrecognised severity is treated as "warning" (the safe middle) so it is
  // neither hidden nor over-escalated — mirrors the backend's clamp.
  return asContinuitySeverity(severity) ?? "warning";
}

/** One warning row: severity badge, message, optional affected-entity chip. */
function WarningRow({ warning }: Readonly<{ warning: ContinuityWarning }>) {
  const key = resolveSeverityKey(warning.severity);
  const style = SEVERITY_STYLE[key];
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Badge
          variant={style.variant}
          size={18}
          icon={<Icon icon={style.icon} size={12} />}
        >
          {hu.inspector.warningsSeverity[key]}
        </Badge>
        {warning.entity ? (
          <span className="inline-flex h-[18px] items-center rounded-full bg-surface-muted px-2 text-[10px] font-medium text-text-soft">
            {warning.entity}
          </span>
        ) : null}
      </div>
      <p className="m-0 text-[12.5px] leading-[1.5] text-text-soft">
        {warning.message}
      </p>
    </li>
  );
}

/** A centered card used for the idle / no-issues / no-scene states. */
function StateCard({
  icon,
  iconClass,
  title,
  hint,
}: Readonly<{
  icon: LucideIcon;
  iconClass?: string;
  title: string;
  hint?: string;
}>) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center">
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-text-faint",
          iconClass,
        )}
      >
        <Icon icon={icon} size={18} />
      </span>
      <p className="m-0 text-[13px] font-semibold text-text">{title}</p>
      {hint ? (
        <p className="m-0 max-w-[240px] text-[12px] leading-[1.5] text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The success result: a list of warnings, or the positive no-issues state. */
function ContinuityWarnings({ result }: Readonly<{ result: ContinuityResult }>) {
  if (result.warnings.length === 0) {
    return (
      <StateCard
        icon={CheckCircle2}
        iconClass="text-success"
        title={hu.inspector.warningsNoIssuesTitle}
        hint={hu.inspector.warningsNoIssuesHint}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[11px] font-semibold text-text-muted">
        {hu.inspector.warningsFound(result.warnings.length)}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {result.warnings.map((warning, index) => (
          // Warnings have no stable id (derived analysis, not persisted rows).
          // Key on the content + index: content disambiguates reorders, index
          // keeps it unique if two warnings happen to be identical.
          <WarningRow
            key={`${warning.severity}:${warning.message}:${index}`}
            warning={warning}
          />
        ))}
      </ul>
    </div>
  );
}

/** The trigger button label for the current mutation state. */
function checkLabel(isPending: boolean, hasRun: boolean): string {
  if (isPending) return hu.inspector.warningsChecking;
  if (hasRun) return hu.inspector.warningsRecheck;
  return hu.inspector.warningsCheck;
}

/**
 * Figyelmeztetések (Warnings) tab — the real B3 RAG-backed continuity checker.
 *
 * Gets the active scene id from the route (like the AI flow does) and the chosen
 * model from the editor store. The "Folytonosság ellenőrzése" button fires the
 * {@link useCheckContinuity} mutation and the tab renders all states:
 *   - no scene open  → an honest no-scene prompt (no button),
 *   - idle           → the pre-check prompt + the trigger button,
 *   - loading        → an in-flight "checking…" indicator,
 *   - list           → severity-coded warning rows (+ optional entity chip),
 *   - empty          → a POSITIVE "no issues found" state,
 *   - error          → the surfaced error (never swallowed).
 *
 * A continuity check is analysis only — it NEVER writes to the manuscript.
 */
export function WarningsTab() {
  const params = useParams<{ sceneId?: string }>();
  const sceneId = params?.sceneId;
  const activeModel = useEditorStore((s) => s.activeModel);
  const setContinuityWarningCount = useEditorStore(
    (s) => s.setContinuityWarningCount,
  );
  const mutation = useCheckContinuity();

  // Mirror the latest check's warning count into the store so the manuscript
  // toolbar's continuity badge reflects it. Analysis-only — never writes the
  // manuscript; the badge is a passive indicator the writer can clear by
  // re-checking. The data object is referentially stable per result, so this
  // fires once per completed check.
  const resultData = mutation.data;
  useEffect(() => {
    if (resultData) setContinuityWarningCount(resultData.warnings.length);
  }, [resultData, setContinuityWarningCount]);

  const header = (
    <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
      {hu.inspector.warningsLabel}
    </p>
  );

  // No scene open (e.g. board view): an honest prompt, no trigger.
  if (!sceneId) {
    return (
      <div className="flex flex-col gap-3.5">
        {header}
        <StateCard icon={Info} title={hu.inspector.warningsNoScene} />
      </div>
    );
  }

  const { isPending, isError, isSuccess, data, error } = mutation;
  const hasRun = isSuccess && data !== undefined;
  const isIdle = !hasRun && !isPending && !isError;

  return (
    <div className="flex flex-col gap-3.5">
      {header}

      <button
        type="button"
        onClick={() => mutation.mutate({ sceneId, model: activeModel })}
        disabled={isPending}
        className="woa-cta flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border-none bg-accent-strong text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon icon={ShieldCheck} size={15} />
        {checkLabel(isPending, hasRun)}
      </button>

      {/* Loading. The button label already announces "checking…"; this is the
          a11y live region (an <output>, which carries an implicit status role)
          that conveys the same to assistive tech without duplicating visible
          text. Visually hidden so the button stays the single visible cue. */}
      {isPending ? (
        <output className="sr-only">{hu.inspector.warningsChecking}</output>
      ) : null}

      {/* Error (never swallowed). The label + detail are separate nodes. */}
      {isError && !isPending ? (
        <div className="flex flex-col gap-0.5" role="alert">
          <p className="m-0 text-[12px] font-semibold text-danger-text">
            {hu.inspector.warningsError}
          </p>
          <p className="m-0 text-[12px] text-danger-text">{error.message}</p>
        </div>
      ) : null}

      {/* Result: warning list or the positive no-issues state. */}
      {hasRun && !isPending ? <ContinuityWarnings result={data} /> : null}

      {/* Idle (no run yet, not loading, no error). */}
      {isIdle ? (
        <StateCard
          icon={ShieldCheck}
          title={hu.inspector.warningsIdleTitle}
          hint={hu.inspector.warningsIdleHint}
        />
      ) : null}
    </div>
  );
}
