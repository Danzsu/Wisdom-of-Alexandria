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
import { ChevronDown, ImageUp, Sparkles } from "lucide-react";
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
    createBook.mutate(
      {
        project: {
          title: data.title,
          description: data.genre || null,
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
              leadingIcon={<Icon icon={Sparkles} size={14} />}
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
        <div>
          <FieldLabel>{hu.wizard.povLabel}</FieldLabel>
          <SegmentedControl<Pov>
            aria-label={hu.wizard.povLabel}
            value={pov}
            onValueChange={(v) => setValue("pov", v, { shouldDirty: true })}
            options={[
              { value: "p1", label: hu.wizard.povFirst },
              { value: "p3k", label: hu.wizard.povThirdLimited },
              { value: "p3m", label: hu.wizard.povThirdOmniscient },
            ]}
          />
        </div>
        <div>
          <FieldLabel>{hu.wizard.audienceLabel}</FieldLabel>
          <SegmentedControl<Audience>
            aria-label={hu.wizard.audienceLabel}
            value={audience}
            onValueChange={(v) =>
              setValue("audience", v, { shouldDirty: true })
            }
            options={[
              { value: "felnott", label: hu.wizard.audienceAdult },
              { value: "ya", label: hu.wizard.audienceYa },
              { value: "gyerek", label: hu.wizard.audienceChild },
            ]}
          />
        </div>
        <div>
          <FieldLabel>{hu.wizard.lengthLabel}</FieldLabel>
          <SegmentedControl<Length>
            aria-label={hu.wizard.lengthLabel}
            value={length}
            onValueChange={(v) => setValue("length", v, { shouldDirty: true })}
            options={[
              { value: "50", label: hu.wizard.length50 },
              { value: "80", label: hu.wizard.length80 },
              { value: "100", label: hu.wizard.length100 },
            ]}
          />
        </div>
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

function StepSummary({ values }: { values: WizardValues }) {
  const rows: { label: string; value: string }[] = [
    { label: hu.wizard.summaryTitle, value: values.title },
    { label: hu.wizard.summaryAuthor, value: values.author },
    { label: hu.wizard.summaryGenre, value: values.genre },
    {
      label: hu.wizard.summaryLanguage,
      value: values.language === "hu" ? hu.wizard.languageHu : hu.wizard.languageEn,
    },
    { label: hu.wizard.summaryPov, value: POV_LABEL[values.pov] },
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
            <span className="text-text">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[12px] text-text-muted">
        {hu.wizard.summaryNote}
      </p>
    </div>
  );
}
