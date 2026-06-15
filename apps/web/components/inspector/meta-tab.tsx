"use client";

import { Badge } from "@/components/kit/badge";
import { hu } from "@/lib/i18n/hu";
import { formatHu } from "@/lib/utils";
import { useInspectorScene } from "./use-inspector-scene";

/** Format an ISO datetime as a short Hungarian local time, or "—" on failure. */
function formatLastSaved(iso: string | undefined): string {
  if (!iso) return hu.inspector.metaUnknown;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return hu.inspector.metaUnknown;
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** A single metadata row (label + value). */
function Row({
  label,
  children,
  last,
}: Readonly<{ label: string; children: React.ReactNode; last?: boolean }>) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-[9px] text-[12px] ${
        last ? "" : "border-b border-border"
      }`}
    >
      <span className="w-24 flex-none text-text-muted">{label}</span>
      <span className="text-text">{children}</span>
    </div>
  );
}

/** Meta tab: the active scene's metadata table, sourced from real scene data. */
export function MetaTab() {
  const { scene, isError } = useInspectorScene();

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {hu.inspector.metaLabel}
      </p>
      {isError ? (
        // The book tree failed to load — surface it instead of silently
        // rendering "—" in every metadata row (mirrors BeatsTab / CodexTab).
        <p className="m-0 text-[12px] text-danger-text" role="alert">
          {hu.write.treeError}
        </p>
      ) : (
      <div className="overflow-hidden rounded-xl border border-border">
        <Row label={hu.inspector.metaStatus}>
          <Badge variant="accent" size={18}>
            {scene?.status ?? hu.inspector.metaUnknown}
          </Badge>
        </Row>
        <Row label={hu.inspector.metaPov}>
          {scene?.pov_character_id ?? hu.inspector.metaUnknown}
        </Row>
        <Row label={hu.inspector.metaLocation}>{hu.inspector.metaUnknown}</Row>
        <Row label={hu.inspector.metaWordCount}>
          <span className="tabular-nums">
            {scene ? formatHu(scene.word_count) : hu.inspector.metaUnknown}
          </span>
        </Row>
        <Row label={hu.inspector.metaLastSaved} last>
          {formatLastSaved(scene?.updated_at)}
        </Row>
      </div>
      )}
    </div>
  );
}
