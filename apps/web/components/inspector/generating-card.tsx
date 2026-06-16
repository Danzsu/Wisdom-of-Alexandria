import { Spinner } from "@/components/kit/spinner";
import { ProgressBar } from "@/components/kit/progress-bar";
import { hu } from "@/lib/i18n/hu";

/**
 * The loading card shown while an AI generation is in flight (request→response;
 * token streaming is V1). Matches the AIResultCard's full AI treatment: a soft
 * `bg-ai-muted` tint + `ring-ai/20` ring (no side-stripe), a faint accent→ai
 * gradient bar, a spinner + status line and an indeterminate progress bar.
 */
export function GeneratingCard() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="overflow-hidden rounded-xl border border-ai/20 bg-ai-muted shadow-card ring-1 ring-ai/20"
    >
      <div
        className="h-0.5 opacity-65"
        style={{ background: "linear-gradient(90deg,var(--accent),var(--ai))" }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="flex items-center gap-2">
          <Spinner size={14} />
          <span className="text-[13px] text-text-muted">
            {hu.inspector.generating}
          </span>
        </div>
        <ProgressBar indeterminate aria-label={hu.inspector.generating} />
      </div>
    </div>
  );
}
