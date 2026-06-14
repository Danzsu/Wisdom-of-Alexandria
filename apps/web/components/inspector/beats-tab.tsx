"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useSceneBeats, useCreateBeat } from "@/lib/api/hooks";
import { useInspectorScene } from "./use-inspector-scene";

/**
 * Beatek tab: lists the active scene's beats from the real `/scenes/{id}/beats`
 * endpoint, with an "Új beat" form that POSTs a new draft beat. Loading / error
 * / empty states are honest.
 */
export function BeatsTab() {
  const { sceneId } = useInspectorScene();
  const beats = useSceneBeats(sceneId);
  const createBeat = useCreateBeat();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const submit = () => {
    const description = draft.trim();
    if (!description || !sceneId) return;
    createBeat.mutate(
      {
        sceneId,
        data: { description, order_index: beats.data?.length ?? 0 },
      },
      {
        onSuccess: () => {
          setDraft("");
          setAdding(false);
        },
        onError: (e) => toast(e.message),
      },
    );
  };

  const items = beats.data ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {hu.inspector.beatsLabel}
      </p>

      {beats.isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-text-muted">
          <Spinner size={13} />
        </div>
      ) : beats.isError ? (
        <p className="m-0 text-[12px] text-danger-text" role="alert">
          {beats.error?.message}
        </p>
      ) : items.length === 0 ? (
        <p className="m-0 text-[12px] text-text-muted">
          {hu.inspector.beatsEmpty}
        </p>
      ) : (
        items.map((beat) => (
          <div
            key={beat.id}
            className="flex flex-col gap-1.5 rounded-[10px] border border-l-[3px] border-border border-l-accent bg-surface p-[11px]"
          >
            <p className="m-0 font-serif text-[13px] leading-[1.55] text-text-soft">
              {beat.description}
            </p>
            <span className="text-[11px] text-text-muted">
              {beat.beat_type ?? hu.inspector.beatsDraft}
            </span>
          </div>
        ))
      )}

      {adding ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            aria-label={hu.inspector.beatsNew}
            placeholder={hu.write.beatInputPlaceholder}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 font-sans text-[13px] text-text outline-none placeholder:text-text-faint focus-visible:border-accent"
          />
          <button
            type="button"
            onClick={submit}
            disabled={createBeat.isPending || draft.trim().length === 0}
            className="h-8 rounded-lg border-none bg-accent-strong text-[12px] font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {hu.inspector.beatsNew}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-transparent text-[12px] text-text-muted hover:border-accent hover:bg-accent-muted hover:text-accent-text"
        >
          <Icon icon={Plus} size={12} />
          {hu.inspector.beatsNew}
        </button>
      )}
    </div>
  );
}
