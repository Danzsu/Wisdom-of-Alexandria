"use client";

/**
 * Add / Edit provider modal (RHF + Zod) for the Cloud subpage (P1.1).
 *
 * Add mode: pick a type, label, API-kulcs (required for cloud types), optional
 * base URL + default model, enabled toggle → `useCreateProvider`.
 *
 * Edit mode: the existing provider is prefilled (label / base_url /
 * default_model / enabled). The API-kulcs field starts BLANK and shows the
 * stored mask as a hint — leaving it blank OMITS `api_key` from the PATCH (keeps
 * the stored key); typing a new value sends it. The full plaintext key is never
 * displayed or requested.
 *
 * Errors surface inline (never swallowed) + a toast.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  FieldLabel,
  FormInput,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  PasswordInput,
  SegmentedControl,
  ToggleSwitch,
  toast,
} from "@/components/kit";
import {
  PROVIDER_TYPES,
  providerTypeNeedsKey,
  type ProviderCreate,
  type ProviderRead,
  type ProviderType,
  type ProviderUpdate,
} from "@/lib/api/providers";
import {
  useCreateProvider,
  useUpdateProvider,
} from "@/lib/api/providers-hooks";
import { hu } from "@/lib/i18n/hu";

/**
 * The form schema. `apiKey` is always a string here (blank = keep on edit /
 * "no key" on create). The cloud-key-required rule depends on BOTH the chosen
 * `type` and the add/edit mode (a blank key on edit means "keep the stored
 * one"), so it cannot be a static field rule — it is enforced in `handleSubmit`
 * via `form.setError`.
 */
const formSchema = z.object({
  type: z.enum(PROVIDER_TYPES),
  label: z.string().trim().min(1, hu.settings.cloudLabelRequired).max(255),
  apiKey: z.string(),
  baseUrl: z.string(),
  defaultModel: z.string(),
  enabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export interface ProviderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The provider being edited, or null for add mode. */
  editing: ProviderRead | null;
}

const TYPE_OPTIONS = PROVIDER_TYPES.map((t) => ({
  value: t,
  label: hu.settings.providerTypeNames[t] ?? t,
}));

export function ProviderFormModal({
  open,
  onOpenChange,
  editing,
}: Readonly<ProviderFormModalProps>) {
  const isEdit = editing !== null;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const isPending = createProvider.isPending || updateProvider.isPending;

  // Edit prefills come straight from `defaultValues`; the api-key field always
  // starts BLANK (we never seed it with the stored key — only its mask is shown
  // as a placeholder). The parent remounts this modal per add/edit session via
  // a `key`, so `defaultValues` is re-read fresh each time without a reset
  // effect (see CloudSubpage).
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      type: editing?.type ?? "gemini",
      label: editing?.label ?? "",
      apiKey: "",
      baseUrl: editing?.base_url ?? "",
      defaultModel: editing?.default_model ?? "",
      enabled: editing?.enabled ?? true,
    },
  });

  const type = form.watch("type");
  const needsKey = providerTypeNeedsKey(type);
  const showBaseUrl = type === "ollama" || type === "custom";

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSubmitError(null);
      form.reset();
    }
    onOpenChange(next);
  }

  function handleSubmit(data: FormValues) {
    setSubmitError(null);
    const trimmedKey = data.apiKey.trim();
    const baseUrl = data.baseUrl.trim();
    const defaultModel = data.defaultModel.trim();

    // Cloud-key-required rule: depends on type + mode. On create a cloud type
    // must carry a key; on edit a blank key keeps the stored one.
    if (needsKey && !trimmedKey && !isEdit) {
      form.setError("apiKey", {
        type: "manual",
        message: hu.settings.cloudKeyRequired,
      });
      return;
    }

    if (isEdit && editing) {
      const patch: ProviderUpdate = {
        label: data.label.trim(),
        base_url: showBaseUrl ? (baseUrl || null) : editing.base_url,
        default_model: defaultModel || null,
        enabled: data.enabled,
      };
      // SECURITY: only send api_key when the user typed a NEW one; otherwise it
      // is OMITTED so the backend keeps the stored key.
      if (trimmedKey) patch.api_key = trimmedKey;

      updateProvider.mutate(
        { providerId: editing.id, patch },
        {
          onSuccess: () => {
            toast.success(hu.settings.cloudUpdatedToast);
            handleOpenChange(false);
          },
          onError: (error) => {
            setSubmitError(error.message);
            toast.error(hu.settings.cloudUpdateError);
          },
        },
      );
      return;
    }

    const body: ProviderCreate = {
      type: data.type,
      label: data.label.trim(),
      base_url: showBaseUrl ? (baseUrl || null) : null,
      default_model: defaultModel || null,
      enabled: data.enabled,
    };
    if (trimmedKey) body.api_key = trimmedKey;

    createProvider.mutate(body, {
      onSuccess: () => {
        toast.success(hu.settings.cloudCreatedToast);
        handleOpenChange(false);
      },
      onError: (error) => {
        setSubmitError(error.message);
        toast.error(hu.settings.cloudCreateError);
      },
    });
  }

  const keyPlaceholder = hu.settings.providerKeyPlaceholders[type] ?? "";

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={480}>
        <ModalHeader
          title={
            isEdit
              ? hu.settings.cloudModalEditTitle
              : hu.settings.cloudModalAddTitle
          }
        />

        <ModalBody>
          <div className="flex flex-col gap-3.5">
            {/* Type — locked on edit (the stored credentials belong to a type). */}
            {isEdit ? (
              <div>
                <FieldLabel htmlFor="pf-type">
                  {hu.settings.cloudModalTypeLabel}
                </FieldLabel>
                <p className="text-[13px] font-medium text-text">
                  {hu.settings.providerTypeNames[editing.type] ?? editing.type}
                </p>
              </div>
            ) : (
              <div>
                <FieldLabel htmlFor="pf-type">
                  {hu.settings.cloudModalTypeLabel}
                </FieldLabel>
                <SegmentedControl<ProviderType>
                  aria-label={hu.settings.cloudModalTypeLabel}
                  options={TYPE_OPTIONS}
                  value={type}
                  onValueChange={(next) =>
                    form.setValue("type", next, { shouldDirty: true })
                  }
                  className="flex-wrap"
                />
              </div>
            )}

            <div>
              <FieldLabel htmlFor="pf-label">
                {hu.settings.cloudModalLabelLabel}
              </FieldLabel>
              <FormInput
                id="pf-label"
                placeholder={hu.settings.cloudModalLabelPlaceholder}
                error={form.formState.errors.label?.message}
                {...form.register("label")}
              />
            </div>

            {needsKey ? (
              <div>
                <FieldLabel htmlFor="pf-key">
                  {hu.settings.cloudModalKeyLabel}
                </FieldLabel>
                <PasswordInput
                  id="pf-key"
                  placeholder={
                    isEdit && editing.api_key_masked
                      ? editing.api_key_masked
                      : keyPlaceholder
                  }
                  autoComplete="off"
                  error={form.formState.errors.apiKey?.message}
                  {...form.register("apiKey")}
                />
                <p className="mt-1 text-[12px] text-text-muted">
                  {isEdit
                    ? hu.settings.cloudModalKeyKeepHint
                    : hu.settings.cloudModalKeyNewHint}
                </p>
              </div>
            ) : null}

            {showBaseUrl ? (
              <div>
                <FieldLabel htmlFor="pf-baseurl">
                  {hu.settings.cloudModalBaseUrlLabel}
                </FieldLabel>
                <FormInput
                  id="pf-baseurl"
                  placeholder={hu.settings.cloudModalBaseUrlPlaceholder}
                  {...form.register("baseUrl")}
                />
              </div>
            ) : null}

            <div>
              <FieldLabel htmlFor="pf-model">
                {hu.settings.cloudModalDefaultModelLabel}
              </FieldLabel>
              <FormInput
                id="pf-model"
                placeholder={hu.settings.cloudModalDefaultModelPlaceholder}
                {...form.register("defaultModel")}
              />
            </div>

            <ToggleSwitch
              label={hu.settings.cloudModalEnabledLabel}
              checked={form.watch("enabled")}
              onCheckedChange={(next) =>
                form.setValue("enabled", next, { shouldDirty: true })
              }
            />
          </div>

          {submitError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-danger border-l-[3px] bg-surface px-3.5 py-3 text-[12px] text-danger-text"
            >
              {submitError}
            </div>
          ) : null}
        </ModalBody>

        <ModalFooter>
          <Button
            variant="secondary"
            size={34}
            onClick={() => handleOpenChange(false)}
          >
            {hu.settings.cloudModalCancel}
          </Button>
          <Button
            variant="cta"
            size={34}
            disabled={isPending}
            onClick={form.handleSubmit(handleSubmit)}
          >
            {isEdit ? hu.settings.cloudModalSave : hu.settings.cloudModalCreate}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}
