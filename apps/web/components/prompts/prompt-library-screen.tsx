"use client";

import { useState } from "react";
import {
  Brain,
  CheckCircle,
  Eye,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  FieldLabel,
  FormInput,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  PageHero,
  SkeletonCard,
  Textarea,
  toast,
} from "@/components/kit";
import { hu } from "@/lib/i18n/hu";
import {
  useCreatePromptTemplate,
  useDeletePromptTemplate,
  usePromptTemplates,
} from "@/lib/api/hooks";
import type { PromptTemplateRead } from "@/lib/api/types";

/**
 * Maps the backend `icon_key` to a lucide icon. Unknown / null keys fall back to
 * a neutral wand glyph so a user template without an icon still renders.
 */
const PROMPT_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  refresh: RefreshCw,
  eye: Eye,
  brain: Brain,
  check: CheckCircle,
};

function iconFor(key: string | null): LucideIcon {
  return (key && PROMPT_ICONS[key]) || Wand2;
}

/**
 * Prompt Library (`konyv/[bookId]/promptok`) — the user-facing AI prompt
 * catalogue, backed by the GLOBAL `/api/v1/prompt-templates` API.
 *
 * Built-in templates (seeded server-side) are read-only; user-created templates
 * can be deleted. "Új prompt" opens a create form that POSTs and refetches the
 * list. Each card opens a read-only detail modal showing the template body.
 */
export function PromptLibraryScreen() {
  const query = usePromptTemplates();
  const createMutation = useCreatePromptTemplate();
  const deleteMutation = useDeletePromptTemplate();

  const [selected, setSelected] = useState<PromptTemplateRead | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    body: "",
  });

  const t = hu.promptLibrary;
  const canSubmit =
    form.name.trim().length > 0 && form.category.trim().length > 0 &&
    form.body.trim().length > 0;

  function resetForm() {
    setForm({ name: "", category: "", description: "", body: "" });
  }

  async function handleCreate() {
    if (!canSubmit) return;
    try {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        body: form.body,
      });
      toast.success(t.createSuccess);
      setCreateOpen(false);
      resetForm();
    } catch {
      toast.error(t.createError);
    }
  }

  async function handleDelete(template: PromptTemplateRead) {
    try {
      await deleteMutation.mutateAsync(template.id);
      if (selected?.id === template.id) setSelected(null);
    } catch {
      toast.error(t.deleteError);
    }
  }

  /** The list region — loading skeletons, error, empty, or the card grid. */
  function renderList() {
    if (query.isLoading) {
      return (
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      );
    }
    if (query.isError) {
      return <ErrorState message={t.loadError} onRetry={() => query.refetch()} />;
    }
    const items = query.data ?? [];
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<Icon icon={Sparkles} size={20} />}
          title={t.empty}
          description={t.emptyHint}
        />
      );
    }
    return (
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
        {items.map((prompt) => {
          const PromptIcon = iconFor(prompt.icon_key);
          return (
            <div
              key={prompt.id}
              className="woa-card-aura relative rounded-[14px] border border-border bg-surface shadow-card transition-transform hover:-translate-y-1"
            >
              <button
                type="button"
                onClick={() => setSelected(prompt)}
                className="block w-full cursor-pointer p-[18px] text-left"
              >
                <span className="mb-[11px] flex items-center gap-[11px]">
                  <span className="inline-flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-ai-muted text-ai-text">
                    <Icon icon={PromptIcon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[19px] font-semibold text-text">
                      {prompt.name}
                    </span>
                  </span>
                  <span className="rounded-full bg-surface-muted px-[9px] py-0.5 text-[10.5px] font-semibold text-text-muted">
                    {prompt.category}
                  </span>
                </span>
                <span className="block text-[13px] leading-[1.55] text-text-muted [text-wrap:pretty]">
                  {prompt.description}
                </span>
                <span className="mt-3 flex items-center gap-1.5 text-[11.5px] text-text-faint">
                  <Icon icon={Sparkles} size={12} aria-hidden />
                  {t.usesLabel(String(prompt.uses))}
                  {prompt.is_builtin ? (
                    <span className="ml-1 rounded-full bg-surface-muted px-[7px] py-0.5 text-[10px] font-semibold text-text-muted">
                      {t.builtinBadge}
                    </span>
                  ) : null}
                </span>
              </button>
              {prompt.is_builtin ? null : (
                <button
                  type="button"
                  aria-label={`${t.deleteLabel}: ${prompt.name}`}
                  onClick={() => handleDelete(prompt)}
                  className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-surface-muted hover:text-danger-text"
                >
                  <Icon icon={Trash2} size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(120%_50%_at_50%_-12%,var(--accent-muted)_0%,transparent_46%)] px-10 pb-20 pt-11">
      <div className="mx-auto max-w-[900px]">
        <PageHero
          className="mb-[26px]"
          eyebrow={t.eyebrow}
          title={t.title}
          subtitle={t.subtitle}
          action={
            <Button
              variant="cta"
              size={40}
              className="h-[38px]"
              leadingIcon={<Icon icon={Plus} size={15} />}
              onClick={() => setCreateOpen(true)}
            >
              {t.newPrompt}
            </Button>
          }
        />

        {renderList()}
      </div>

      {/* Read-only detail modal. */}
      <Modal
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected ? (
          <ModalShell maxWidth={560}>
            <ModalHeader
              title={selected.name}
              leadingIcon={
                <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-ai-muted text-ai-text">
                  <Icon icon={iconFor(selected.icon_key)} size={17} />
                </span>
              }
              closeLabel={t.modalClose}
            />
            <ModalBody className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-surface-muted px-[9px] py-0.5 text-[10.5px] font-semibold text-text-muted">
                  {selected.category}
                </span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-text-faint">
                  <Icon icon={Sparkles} size={12} aria-hidden />
                  {t.usesLabel(String(selected.uses))}
                </span>
              </div>

              <div>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-text-faint">
                  {t.modalDescription}
                </h3>
                <p className="m-0 text-[13.5px] leading-[1.55] text-text-soft [text-wrap:pretty]">
                  {selected.description}
                </p>
              </div>

              <div>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-text-faint">
                  {t.modalTemplate}
                </h3>
                <pre className="m-0 whitespace-pre-wrap rounded-[12px] border border-border bg-surface-soft p-3.5 font-serif text-[13.5px] leading-[1.6] text-text">
                  {selected.body}
                </pre>
              </div>
            </ModalBody>
          </ModalShell>
        ) : null}
      </Modal>

      {/* Create modal — POSTs a user template, then refetches the list. */}
      <Modal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <ModalShell maxWidth={560}>
          <ModalHeader
            title={t.createTitle}
            leadingIcon={
              <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-ai-muted text-ai-text">
                <Icon icon={Plus} size={17} />
              </span>
            }
            closeLabel={t.modalClose}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <ModalBody className="space-y-3.5">
              <div>
                <FieldLabel htmlFor="prompt-name">{t.fieldName}</FieldLabel>
                <FormInput
                  id="prompt-name"
                  value={form.name}
                  placeholder={t.namePlaceholder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <FieldLabel htmlFor="prompt-category">
                  {t.fieldCategory}
                </FieldLabel>
                <FormInput
                  id="prompt-category"
                  value={form.category}
                  placeholder={t.categoryPlaceholder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
              </div>
              <div>
                <FieldLabel htmlFor="prompt-description">
                  {t.fieldDescription}
                </FieldLabel>
                <FormInput
                  id="prompt-description"
                  value={form.description}
                  placeholder={t.descriptionPlaceholder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div>
                <FieldLabel htmlFor="prompt-body">{t.fieldBody}</FieldLabel>
                <Textarea
                  id="prompt-body"
                  variant="mono"
                  minHeight={140}
                  value={form.body}
                  placeholder={t.bodyPlaceholder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                variant="cta"
                disabled={!canSubmit}
                loading={createMutation.isPending}
              >
                {t.submit}
              </Button>
            </ModalFooter>
          </form>
        </ModalShell>
      </Modal>
    </div>
  );
}
