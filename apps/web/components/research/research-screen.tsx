"use client";

/**
 * Kutatás (Codex/manuscript RAG Q&A) screen — fills the book's `chat` route.
 *
 * A single-turn grounded Q&A: the user asks a question, the answer is generated
 * from the project's Codex + manuscript via RAG, and the cited entries are shown
 * as chips. Project-scoped (resolved from the route `bookId` via the shared
 * resolver). NEVER writes to the manuscript — this is analysis only. Errors and
 * the no-provider degradation are surfaced honestly, never swallowed.
 */
import { useState } from "react";
import { Search } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { Button, EmptyState, ErrorState } from "@/components/kit";
import { Spinner } from "@/components/kit/spinner";
import { ContextChips } from "@/components/kit/context-chips";
import { useBookProjectId, useResearch } from "@/lib/api/ai-hooks";
import { hu } from "@/lib/i18n/hu";

export interface ResearchScreenProps {
  bookId: string | undefined;
}

export function ResearchScreen({ bookId }: ResearchScreenProps) {
  const projectIdQuery = useBookProjectId(bookId);
  const projectId = projectIdQuery.data;
  const researchMutation = useResearch();

  const [question, setQuestion] = useState("");

  const canAsk =
    Boolean(projectId) &&
    question.trim().length > 0 &&
    !researchMutation.isPending;

  const submit = () => {
    if (!projectId || question.trim().length === 0) return;
    researchMutation.mutate({ question: question.trim(), projectId });
  };

  const result = researchMutation.data;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-10">
      <div className="mx-auto max-w-[680px]">
        <h1 className="mb-1 flex items-center gap-2 text-[22px] font-semibold text-text">
          <BrandStar size={18} />
          {hu.research.title}
        </h1>
        <p className="mb-6 text-[13px] text-text-muted">
          {hu.research.subtitle}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2"
        >
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-text-faint focus-within:border-accent">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={hu.research.placeholder}
              aria-label={hu.research.questionAria}
              className="w-full bg-transparent text-[14px] text-text outline-none placeholder:text-text-faint"
            />
          </label>
          <Button
            type="submit"
            variant="cta"
            size={40}
            disabled={!canAsk}
            leadingIcon={
              researchMutation.isPending ? <Spinner size={14} /> : undefined
            }
          >
            {researchMutation.isPending ? hu.research.asking : hu.research.ask}
          </Button>
        </form>

        <div className="mt-6">
          {researchMutation.isError ? (
            <ErrorState
              message={hu.research.errorRetry}
              onRetry={() => researchMutation.reset()}
            />
          ) : result !== undefined ? (
            <article className="rounded-[14px] border border-border bg-surface p-5 shadow-card">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                {hu.research.answerLabel}
              </h2>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text">
                {result.answer}
              </p>
              {result.context_entities.length > 0 ? (
                <ContextChips
                  className="mt-4"
                  label={hu.research.citationsLabel}
                  entities={result.context_entities.map((e) => ({
                    label: e.label,
                  }))}
                />
              ) : (
                <p className="mt-4 text-[12px] text-text-muted">
                  {hu.research.noCitations}
                </p>
              )}
            </article>
          ) : (
            <EmptyState
              icon={<BrandStar size={22} />}
              title={hu.research.emptyTitle}
              description={hu.research.emptyHint}
            />
          )}
        </div>
      </div>
    </div>
  );
}
