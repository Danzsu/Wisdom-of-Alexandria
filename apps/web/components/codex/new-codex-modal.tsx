"use client";

/**
 * New-Codex modal — a two-step modal (RHF + Zod) recreating the prototype `neon`
 * flow (Alexandria App.dc.html ~line 2948):
 *   (1) type-picker grid (Karakter / Helyszín / Tárgy / Szervezet / Lore /
 *       Szabály) → (2) form (Név required / Álnevek / Leírás / "Nyomon
 *       követés" checkbox).
 *
 * On submit it creates the entry via {@link useCreateCodexEntry}, folding the
 * aliases into the real `tags` list (the backend has no `aliases` column — see
 * lib/api/codex.ts). On success it selects the new entry + toasts. Errors are
 * surfaced inline (never swallowed).
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import {
  Button,
  CheckboxRow,
  FieldLabel,
  FormInput,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  Textarea,
  toast,
} from "@/components/kit";
import { BrandStar } from "@/components/kit/brand-star";
import {
  CODEX_ENTRY_TYPES,
  encodeTags,
  parseAliasInput,
  type CodexEntryType,
} from "@/lib/api/codex";
import { useCreateCodexEntry } from "@/lib/api/hooks";
import { entryTypeIcon } from "./codex-meta";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";

const formSchema = z.object({
  title: z.string().trim().min(1, hu.codex.modalNameRequired).max(255),
  aliases: z.string(),
  description: z.string(),
  track: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

export interface NewCodexModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The owning project id (codex is project-scoped). */
  projectId: string | undefined;
  /** Fired with the created entry's id so the screen can select it. */
  onCreated: (entryId: string) => void;
}

/** Type-picker tile colour per type (matches the prototype accent chips). */
const TILE_TONE: Record<CodexEntryType, string> = {
  character: "bg-pov2-bg text-pov2-tx",
  location: "bg-pov4-bg text-pov4-tx",
  object: "bg-pov1-bg text-pov1-tx",
  organization: "bg-pov3-bg text-pov3-tx",
  lore: "bg-surface-muted text-accent-text",
  rule: "bg-surface-muted text-accent-text",
};

export function NewCodexModal({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: NewCodexModalProps) {
  const [type, setType] = useState<CodexEntryType | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createEntry = useCreateCodexEntry();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { title: "", aliases: "", description: "", track: true },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setType(null);
      setSubmitError(null);
      form.reset();
    }
    onOpenChange(next);
  }

  function handleCreate(data: FormValues) {
    if (!projectId || !type) return;
    setSubmitError(null);
    // The "Nyomon követés" checkbox controls name-based recognition. When OFF we
    // record the opt-out via the codec's `trackingOff` control key so the
    // Tracking tab can reflect it; everything stays in the real `tags` list.
    const aliases = parseAliasInput(data.aliases);
    createEntry.mutate(
      {
        projectId,
        data: {
          title: data.title.trim(),
          entry_type: type,
          content: data.description.trim() ? data.description.trim() : null,
          ai_visible: true,
          tags: encodeTags({
            aliases,
            role: null,
            labels: [],
            trackingOff: !data.track,
          }),
        },
      },
      {
        onSuccess: (created) => {
          toast.success(hu.codex.createdToast);
          handleOpenChange(false);
          onCreated(created.id);
        },
        onError: (error) => {
          setSubmitError(error.message);
          toast.error(hu.codex.createError);
        },
      },
    );
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={540}>
        <ModalHeader
          title={hu.codex.modalTitle}
          leading={
            type ? (
              <button
                type="button"
                aria-label={hu.codex.modalBackAria}
                onClick={() => setType(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
              >
                <Icon icon={ChevronLeft} size={15} />
              </button>
            ) : undefined
          }
        />

        <ModalBody>
          {!type ? (
            <>
              <p className="m-0 mb-3.5 text-[13px] text-text-muted">
                {hu.codex.modalPickerPrompt}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {CODEX_ENTRY_TYPES.map((t) => {
                  const card = hu.codex.pickerCards[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className="flex items-center gap-[11px] rounded-xl border border-border bg-surface p-[13px] text-left hover:border-accent hover:bg-accent-muted"
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 flex-none items-center justify-center rounded-[10px]",
                          TILE_TONE[t],
                        )}
                      >
                        <Icon icon={entryTypeIcon(t)} size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-text">
                          {card.label}
                        </span>
                        <span className="block text-[11px] text-text-muted">
                          {card.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full bg-accent-muted px-[11px] text-[12px] font-semibold text-accent-text">
                  {hu.codex.typeLabel[type]}
                </span>
                <span className="text-[12px] text-text-muted">
                  {hu.codex.modalTypeSuffix}
                </span>
              </div>
              <div className="flex flex-col gap-3.5">
                <div>
                  <FieldLabel htmlFor="nec-title">
                    {hu.codex.modalNameLabel}
                  </FieldLabel>
                  <FormInput
                    id="nec-title"
                    placeholder={hu.codex.modalNamePlaceholder}
                    className="font-medium"
                    error={form.formState.errors.title?.message}
                    {...form.register("title")}
                  />
                </div>
                <div>
                  <FieldLabel
                    htmlFor="nec-aliases"
                    hint={<BrandStar size={12} variant="sparkle" />}
                  >
                    {hu.codex.modalAliasesLabel}
                  </FieldLabel>
                  <FormInput
                    id="nec-aliases"
                    placeholder={hu.codex.aliasesPlaceholder}
                    {...form.register("aliases")}
                  />
                </div>
                <div>
                  <FieldLabel
                    htmlFor="nec-desc"
                    hint={<BrandStar size={12} variant="sparkle" />}
                  >
                    {hu.codex.modalDescriptionLabel}
                  </FieldLabel>
                  <Textarea
                    id="nec-desc"
                    rows={4}
                    minHeight={92}
                    variant="manuscript"
                    placeholder={hu.codex.modalDescriptionPlaceholder}
                    {...form.register("description")}
                  />
                </div>
                <CheckboxRow
                  label={hu.codex.modalTrackLabel}
                  checked={form.watch("track")}
                  onCheckedChange={(next) =>
                    form.setValue("track", next === true, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>

              {submitError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-danger border-l-[3px] bg-surface px-3.5 py-3 text-[12px] text-danger-text"
                >
                  {hu.codex.createError}: {submitError}
                </div>
              ) : null}
            </>
          )}
        </ModalBody>

        {type ? (
          <ModalFooter>
            <Button
              variant="secondary"
              size={34}
              onClick={() => handleOpenChange(false)}
            >
              {hu.codex.modalCancel}
            </Button>
            <Button
              variant="cta"
              size={34}
              disabled={createEntry.isPending}
              onClick={form.handleSubmit(handleCreate)}
            >
              {hu.codex.modalCreate}
            </Button>
          </ModalFooter>
        ) : null}
      </ModalShell>
    </Modal>
  );
}
