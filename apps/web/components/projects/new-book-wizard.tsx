"use client";

/**
 * New-book Wizard — a 3-step modal (RHF + Zod) recreating the prototype `wizon`
 * flow. On submit it creates a Project then a Book under it (faithful to the
 * nested backend contract) via {@link useCreateBookWithProject}, then navigates
 * to the new book's plan view. Cover upload is a stub (toast only).
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ImageUp } from "lucide-react";
import {
  Button,
  FieldLabel,
  FormInput,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  PopoverMenu,
  PopoverMenuContent,
  PopoverMenuTrigger,
  MenuRow,
  PillButton,
  SegmentedControl,
  Textarea,
  toast,
} from "@/components/kit";
import { BrandStar } from "@/components/kit/brand-star";
import { useCreateBookWithProject } from "@/lib/api/hooks";
import { useNavTo } from "@/lib/use-nav-to";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";

/** Language / POV / audience / length value unions used by the form. */
type Language = "hu" | "en";
type Pov = "p1" | "p3k" | "p3m";
type Audience = "felnott" | "ya" | "gyerek";
type Length = "50" | "80" | "100";

/** Maps the length token to a concrete word-count target for the API. */
const LENGTH_TO_WORDS: Record<Length, number> = {
  "50": 50000,
  "80": 80000,
  "100": 100000,
};

/** Human-readable labels for the summary step + POV summary line. */
const POV_LABEL: Record<Pov, string> = {
  p1: hu.wizard.povFirst,
  p3k: hu.wizard.povThirdLimited,
  p3m: hu.wizard.povThirdOmniscient,
};
const LENGTH_LABEL: Record<Length, string> = {
  "50": hu.wizard.length50,
  "80": hu.wizard.length80,
  "100": hu.wizard.length100,
};

/** Zod schema — Cím required, the rest typed with sensible defaults. */
const wizardSchema = z.object({
  title: z.string().trim().min(1, hu.wizard.titleRequired).max(255),
  author: z.string().trim().max(255),
  genre: z.string(),
  language: z.enum(["hu", "en"]),
  pov: z.enum(["p1", "p3k", "p3m"]),
  audience: z.enum(["felnott", "ya", "gyerek"]),
  length: z.enum(["50", "80", "100"]),
  style: z.string(),
});
type WizardValues = z.infer<typeof wizardSchema>;

const STEPS = [1, 2, 3] as const;
type Step = (typeof STEPS)[number];

export interface NewBookWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewBookWizard({ open, onOpenChange }: NewBookWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navTo = useNavTo();
  const createBook = useCreateBookWithProject();

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      author: hu.user.name,
      genre: hu.genres[0],
      language: "hu",
      pov: "p3k",
      audience: "felnott",
      length: "80",
      style: "",
    },
  });

  const values = form.watch();

  /** Reset everything when the modal is dismissed so a reopen starts clean. */
  function handleOpenChange(next: boolean) {
    if (!next) {
      setStep(1);
      setSubmitError(null);
      form.reset();
    }
    onOpenChange(next);
  }

  /** Advance from step 1 only when the title validates. */
  async function handleNext() {
    if (step === 1) {
      const ok = await form.trigger("title");
      if (!ok) return;
    }
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  }

  function handleBack() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  /** Build the API payloads and run the two-step create. */
  function handleCreate(data: WizardValues) {
    setSubmitError(null);
    // NOTE (MVP contract, see apps/api/app/schemas/book.py): the backend Book
    // schema has NO author / POV / audience fields. We collect those in the
    // wizard for V1 but intentionally do NOT persist them here — there is no MVP
    // slot to store them. The summary step labels them accordingly so the user
    // is never told they were saved. The genre maps ONLY to the book's `genre`
    // field; the project's `description` is left null (genre is a book concept,
    // not a project description). Style preferences are stored on the book's
    // synopsis slot for now (no dedicated field), mirrored below.
    createBook.mutate(
      {
        project: {
          title: data.title,
          // genre is NOT a project description — leave it null (no fabrication).
          description: null,
          language: data.language,
        },
        book: {
          title: data.title,
          genre: data.genre || null,
          language: data.language,
          word_count_target: LENGTH_TO_WORDS[data.length],
          order_index: 0,
          // Style preferences are captured for V1; stored on the book synopsis
          // slot for now (no dedicated field in the MVP contract).
          synopsis: data.style.trim() ? data.style.trim() : null,
          // author / pov / audience: collected (data.author/.pov/.audience) but
          // intentionally NOT persisted — no MVP field exists for them.
        },
      },
      {
        onSuccess: (book) => {
          toast.success(hu.wizard.successToast);
          handleOpenChange(false);
          navTo(routes.book(book.id, "terv"));
        },
        onError: (error) => {
          // ApiError carries a server-derived message; any other Error still
          // has a `.message`. Either way we surface it (never swallow).
          setSubmitError(error.message);
          toast.error(hu.wizard.errorTitle);
        },
      },
    );
  }

  const isLast = step === 3;

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={540} description={hu.wizard.dialogDescription}>
        <ModalHeader
          title={hu.wizard.dialogTitle}
          leadingIcon={<BrandStar size={17} />}
        />

        {/* 3-segment progress bar (active = accent). */}
        <div className="flex flex-none gap-1.5 px-5 pt-3.5">
          {STEPS.map((s) => (
            <span
              key={s}
              data-active={s <= step || undefined}
              className={
                s <= step
                  ? "h-1 flex-1 rounded-full bg-accent-strong"
                  : "h-1 flex-1 rounded-full bg-surface-muted"
              }
            />
          ))}
        </div>

        <ModalBody>
          {step === 1 ? (
            <StepBasics form={form} />
          ) : step === 2 ? (
            <StepStyle form={form} />
          ) : (
            <StepSummary values={values} />
          )}

          {submitError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-danger border-l-[3px] bg-surface px-3.5 py-3 text-[12px] text-danger-text"
            >
              {hu.wizard.errorTitle}: {submitError}
            </div>
          ) : null}
        </ModalBody>

        <ModalFooter className="justify-start">
          {step > 1 ? (
            <Button variant="secondary" size={34} onClick={handleBack}>
              {hu.wizard.back}
            </Button>
          ) : null}
          <div className="flex-1" />
          {!isLast ? (
            <Button variant="cta" size={34} onClick={handleNext}>
              {hu.wizard.next}
            </Button>
          ) : (
            <Button
              variant="cta"
              size={34}
              disabled={createBook.isPending}
              leadingIcon={<BrandStar size={14} />}
              onClick={form.handleSubmit(handleCreate)}
            >
              {hu.wizard.create}
            </Button>
          )}
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — Alapadatok                                                        */
/* -------------------------------------------------------------------------- */

function StepBasics({
  form,
}: {
  form: ReturnType<typeof useForm<WizardValues>>;
}) {
  const { register, formState, watch, setValue } = form;
  const genre = watch("genre");
  const language = watch("language");
  const [genreOpen, setGenreOpen] = useState(false);

  return (
    <div>
      <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {hu.wizard.step1Eyebrow}
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          aria-label={hu.wizard.coverAria}
          onClick={() => toast.info(hu.wizard.coverToast)}
          className="flex h-[106px] w-[76px] flex-none cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[10px] border-2 border-dashed border-border-strong bg-surface-muted text-[10px] text-text-faint transition-colors hover:border-accent hover:text-accent-text"
        >
          <Icon icon={ImageUp} size={18} />
          {hu.wizard.coverLabel}
        </button>
        <div className="flex flex-1 flex-col gap-2.5">
          <div>
            <FieldLabel htmlFor="wiz-title">{hu.wizard.titleLabel}</FieldLabel>
            <FormInput
              id="wiz-title"
              placeholder={hu.wizard.titlePlaceholder}
              className="font-semibold"
              error={formState.errors.title?.message}
              {...register("title")}
            />
          </div>
          <div>
            <FieldLabel htmlFor="wiz-author">
              {hu.wizard.authorLabel}
            </FieldLabel>
            <FormInput id="wiz-author" {...register("author")} />
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-end gap-3.5">
        <div className="flex-1">
          <FieldLabel>{hu.wizard.genreLabel}</FieldLabel>
          <PopoverMenu open={genreOpen} onOpenChange={setGenreOpen}>
            <PopoverMenuTrigger asChild>
              <button
                type="button"
                className="flex h-[34px] w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] text-text transition-colors hover:border-border-strong"
              >
                <span className="flex-1 text-left">{genre}</span>
                <Icon icon={ChevronDown} size={11} />
              </button>
            </PopoverMenuTrigger>
            <PopoverMenuContent className="max-h-[260px] overflow-y-auto">
              {hu.genres.map((g) => (
                <MenuRow
                  key={g}
                  onSelect={() =>
                    setValue("genre", g, { shouldDirty: true })
                  }
                >
                  {g}
                </MenuRow>
              ))}
            </PopoverMenuContent>
          </PopoverMenu>
        </div>
        <div>
          <FieldLabel>{hu.wizard.languageLabel}</FieldLabel>
          <SegmentedControl<Language>
            aria-label={hu.wizard.languageLabel}
            value={language}
            onValueChange={(v) => setValue("language", v, { shouldDirty: true })}
            className="h-[34px]"
            options={[
              { value: "hu", label: hu.wizard.languageHu },
              { value: "en", label: hu.wizard.languageEn },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — Stílus és AI                                                       */
/* -------------------------------------------------------------------------- */

/** A wrapping group of single-select pills (replaces the joined segmented
 * control where the Hungarian labels are too long to fit one row — proto 3580). */
function PillGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <PillButton
              key={option.value}
              size={30}
              role="radio"
              aria-checked={active}
              active={active}
              // Prototype selected pill is a solid accent-strong fill (proto 3580).
              className={
                active
                  ? "border-accent bg-accent-strong font-semibold text-accent-fg"
                  : undefined
              }
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}

function StepStyle({
  form,
}: {
  form: ReturnType<typeof useForm<WizardValues>>;
}) {
  const { watch, setValue, register } = form;
  const pov = watch("pov");
  const audience = watch("audience");
  const length = watch("length");

  return (
    <div>
      <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {hu.wizard.step2Eyebrow}
      </p>
      <div className="flex flex-col gap-3.5">
        <PillGroup<Pov>
          label={hu.wizard.povLabel}
          value={pov}
          onChange={(v) => setValue("pov", v, { shouldDirty: true })}
          options={[
            { value: "p1", label: hu.wizard.povFirst },
            { value: "p3k", label: hu.wizard.povThirdLimited },
            { value: "p3m", label: hu.wizard.povThirdOmniscient },
          ]}
        />
        <PillGroup<Audience>
          label={hu.wizard.audienceLabel}
          value={audience}
          onChange={(v) => setValue("audience", v, { shouldDirty: true })}
          options={[
            { value: "felnott", label: hu.wizard.audienceAdult },
            { value: "ya", label: hu.wizard.audienceYa },
            { value: "gyerek", label: hu.wizard.audienceChild },
          ]}
        />
        <PillGroup<Length>
          label={hu.wizard.lengthLabel}
          value={length}
          onChange={(v) => setValue("length", v, { shouldDirty: true })}
          options={[
            { value: "50", label: hu.wizard.length50 },
            { value: "80", label: hu.wizard.length80 },
            { value: "100", label: hu.wizard.length100 },
          ]}
        />
        <div>
          <FieldLabel htmlFor="wiz-style">{hu.wizard.styleLabel}</FieldLabel>
          <Textarea
            id="wiz-style"
            rows={3}
            minHeight={72}
            placeholder={hu.wizard.stylePlaceholder}
            {...register("style")}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — Összegzés                                                          */
/* -------------------------------------------------------------------------- */

/** Human-readable audience labels for the summary step. */
const AUDIENCE_LABEL: Record<Audience, string> = {
  felnott: hu.wizard.audienceAdult,
  ya: hu.wizard.audienceYa,
  gyerek: hu.wizard.audienceChild,
};

function StepSummary({ values }: { values: WizardValues }) {
  // `notSaved` rows are collected for V1 but NOT persisted by the MVP create
  // (see handleCreate) — we tag them so the user is never told they were saved.
  const rows: { label: string; value: string; notSaved?: boolean }[] = [
    { label: hu.wizard.summaryTitle, value: values.title },
    { label: hu.wizard.summaryAuthor, value: values.author, notSaved: true },
    { label: hu.wizard.summaryGenre, value: values.genre },
    {
      label: hu.wizard.summaryLanguage,
      value: values.language === "hu" ? hu.wizard.languageHu : hu.wizard.languageEn,
    },
    { label: hu.wizard.summaryPov, value: POV_LABEL[values.pov], notSaved: true },
    {
      label: hu.wizard.summaryAudience,
      value: AUDIENCE_LABEL[values.audience],
      notSaved: true,
    },
    { label: hu.wizard.summaryLength, value: LENGTH_LABEL[values.length] },
  ];

  return (
    <div>
      <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {hu.wizard.step3Eyebrow}
      </p>
      <div className="overflow-hidden rounded-xl border border-border">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={
              "flex gap-2.5 px-3.5 py-2.5 text-[13px]" +
              (i < rows.length - 1 ? " border-b border-border" : "")
            }
          >
            <span className="w-[130px] flex-none text-text-muted">
              {row.label}
            </span>
            <span className="text-text">
              {row.value}
              {row.notSaved ? (
                <span className="ml-1.5 text-[11px] text-text-faint">
                  {hu.wizard.summaryNotSavedTag}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[12px] text-text-muted">
        {hu.wizard.summaryNote}
      </p>
    </div>
  );
}
