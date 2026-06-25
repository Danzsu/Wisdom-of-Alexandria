"use client";

import { useState } from "react";
import {
  Brain,
  CheckCircle,
  Eye,
  Pencil,
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
  useUpdatePromptTemplate,
} from "@/lib/api/hooks";
import type { PromptTemplateRead, PromptTemplateUpdate } from "@/lib/api/types";

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

/** The editable fields shared by the create and edit forms. */
interface PromptFormState {
  name: string;
  category: string;
  description: string;
  body: string;
}

const EMPTY_FORM: PromptFormState = {
  name: "",
  category: "",
  description: "",
  body: "",
};

/**
 * The form-body markup shared by both the create and edit modals (DRY — a
 * single source for the four field rows). The parent owns the state and submit
 * handler; this only renders the inputs.
 */
function PromptFormFields({
  form,
  onChange,
}: Readonly<{
  form: PromptFormState;
  onChange: (patch: Partial<PromptFormState>) => void;
}>) {
  const t = hu.promptLibrary;
  return (
    <ModalBody className="space-y-3.5">
      <div>
        <FieldLabel htmlFor="prompt-name">{t.fieldName}</FieldLabel>
        <FormInput
          id="prompt-name"
          value={form.name}
          placeholder={t.namePlaceholder}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel htmlFor="prompt-category">{t.fieldCategory}</FieldLabel>
        <FormInput
          id="prompt-category"
          value={form.category}
          placeholder={t.categoryPlaceholder}
          onChange={(e) => onChange({ category: e.target.value })}
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
          onChange={(e) => onChange({ description: e.target.value })}
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
          onChange={(e) => onChange({ body: e.target.value })}
        />
      </div>
    </ModalBody>
  );
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
  const updateMutation = useUpdatePromptTemplate();
  const deleteMutation = useDeletePromptTemplate();

  const [selected, setSelected] = useState<PromptTemplateRead | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PromptFormState>(EMPTY_FORM);
  // The template currently being edited (drives the prefilled edit modal); null
  // when the edit modal is closed.
  const [editing, setEditing] = useState<PromptTemplateRead | null>(null);
  const [editForm, setEditForm] = useState<PromptFormState>(EMPTY_FORM);

  const t = hu.promptLibrary;

  function isFormValid(f: PromptFormState) {
    return (
      f.name.trim().length > 0 &&
      f.category.trim().length > 0 &&
      f.body.trim().length > 0
    );
  }
  const canCreate = isFormValid(createForm);
  const canSave = isFormValid(editForm);

  function resetCreateForm() {
    setCreateForm(EMPTY_FORM);
  }

  async function handleCreate() {
    if (!canCreate) return;
    try {
      await createMutation.mutateAsync({
        name: createForm.name.trim(),
        category: createForm.category.trim(),
        description: createForm.description.trim(),
        body: createForm.body,
      });
      toast.success(t.createSuccess);
      setCreateOpen(false);
      resetCreateForm();
    } catch {
      toast.error(t.createError);
    }
  }

  /** Open the edit modal prefilled with the template's current values. */
  function openEdit(template: PromptTemplateRead) {
    setEditing(template);
    setEditForm({
      name: template.name,
      category: template.category,
      description: template.description,
      body: template.body,
    });
  }

  async function handleUpdate() {
    if (!editing || !canSave) return;
    const patch: PromptTemplateUpdate = {
      name: editForm.name.trim(),
      category: editForm.category.trim(),
      description: editForm.description.trim(),
      body: editForm.body,
    };
    try {
      await updateMutation.mutateAsync({ id: editing.id, patch });
      toast.success(t.updateSuccess);
      setEditing(null);
    } catch {
      toast.error(t.updateError);
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
                <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${t.editLabel}: ${prompt.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(prompt);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-surface-muted hover:text-ai-text"
                  >
                    <Icon icon={Pencil} size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t.deleteLabel}: ${prompt.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(prompt);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-surface-muted hover:text-danger-text"
                  >
                    <Icon icon={Trash2} size={14} />
                  </button>
                </div>
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
          if (!open) resetCreateForm();
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
            <PromptFormFields
              form={createForm}
              onChange={(patch) => setCreateForm((f) => ({ ...f, ...patch }))}
            />
            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                variant="cta"
                disabled={!canCreate}
                loading={createMutation.isPending}
              >
                {t.submit}
              </Button>
            </ModalFooter>
          </form>
        </ModalShell>
      </Modal>

      {/* Edit modal — PATCHes a user template (prefilled), then refetches. */}
      <Modal
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <ModalShell maxWidth={560}>
          <ModalHeader
            title={t.editTitle}
            leadingIcon={
              <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-ai-muted text-ai-text">
                <Icon icon={Pencil} size={17} />
              </span>
            }
            closeLabel={t.modalClose}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleUpdate();
            }}
          >
            <PromptFormFields
              form={editForm}
              onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
            />
            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(null)}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                variant="cta"
                disabled={!canSave}
                loading={updateMutation.isPending}
              >
                {t.editSubmit}
              </Button>
            </ModalFooter>
          </form>
        </ModalShell>
      </Modal>
    </div>
  );
}
