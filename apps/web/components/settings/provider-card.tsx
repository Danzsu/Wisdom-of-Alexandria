"use client";

/**
 * One configured-provider card on the Cloud subpage (P1.1). Shows the provider
 * type/label, the MASKED key state (never the real key), an enabled toggle, a
 * "Kapcsolat tesztelése" button with an ok/fail result badge, an optional model
 * count, and edit / delete affordances.
 *
 * SECURITY: only `api_key_masked` / `has_key` are ever displayed — the full
 * stored key is never rendered or requested.
 */
import { Pencil, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  IconButton,
  Icon,
  Spinner,
  StatusDot,
  ToggleSwitch,
} from "@/components/kit";
import {
  useProviderModels,
  useTestProvider,
  useUpdateProvider,
} from "@/lib/api/providers-hooks";
import { providerTypeNeedsKey, type ProviderRead } from "@/lib/api/providers";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";

export interface ProviderCardProps {
  provider: ProviderRead;
  onEdit: (provider: ProviderRead) => void;
  onDelete: (provider: ProviderRead) => void;
}

/** Describe the key state line (never shows the real key — masked only). */
function keyStateLabel(provider: ProviderRead): string {
  if (!providerTypeNeedsKey(provider.type)) {
    return provider.base_url
      ? `${hu.settings.cloudNoKeyNeeded} · ${provider.base_url}`
      : hu.settings.cloudNoKeyNeeded;
  }
  if (provider.has_key) {
    return provider.api_key_masked
      ? `${hu.settings.cloudKeyStored} · ${provider.api_key_masked}`
      : hu.settings.cloudKeyStored;
  }
  return hu.settings.cloudKeyMissing;
}

export function ProviderCard({
  provider,
  onEdit,
  onDelete,
}: Readonly<ProviderCardProps>) {
  const testProvider = useTestProvider();
  const updateProvider = useUpdateProvider();
  // Models are fetched lazily, only when the user runs a successful test, so we
  // do not hit the provider's API on every render. Gated on `has_key`/enabled.
  const modelsQuery = useProviderModels(
    provider.id,
    provider.enabled && (provider.has_key || !providerTypeNeedsKey(provider.type)),
  );

  const typeName = hu.settings.providerTypeNames[provider.type] ?? provider.type;
  const testResult = testProvider.data;

  function handleToggleEnabled(next: boolean) {
    // Omit api_key (keep the stored key) — this only flips `enabled`.
    updateProvider.mutate(
      { providerId: provider.id, patch: { enabled: next } },
      {
        onError: (error) => {
          toast.error(`${hu.settings.cloudUpdateError}: ${error.message}`);
        },
      },
    );
  }

  function handleTest() {
    testProvider.mutate(provider.id, {
      onError: (error) => {
        toast.error(`${hu.settings.cloudTestErrorToast}: ${error.message}`);
      },
    });
  }

  const modelCount = modelsQuery.data?.models.length;

  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <div className="flex items-start gap-2.5">
        <StatusDot
          variant={provider.enabled ? "ai" : "neutral"}
          size={8}
          className="mt-1.5"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-text">
            {provider.label}
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">{typeName}</p>
          <p className="mt-0.5 truncate text-[12px] text-text-soft">
            {keyStateLabel(provider)}
          </p>
        </div>
        <div className="flex flex-none items-center gap-1">
          <IconButton
            size={30}
            aria-label={hu.settings.cloudEditAria(provider.label)}
            onClick={() => onEdit(provider)}
          >
            <Icon icon={Pencil} size={14} />
          </IconButton>
          <IconButton
            size={30}
            aria-label={hu.settings.cloudDeleteAria(provider.label)}
            onClick={() => onDelete(provider)}
          >
            <Icon icon={Trash2} size={14} />
          </IconButton>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <ToggleSwitch
          size="sm"
          checked={provider.enabled}
          disabled={updateProvider.isPending}
          onCheckedChange={handleToggleEnabled}
          aria-label={hu.settings.cloudEnableAria(provider.label)}
          label={hu.settings.cloudEnabledLabel}
        />
        <span className="flex-1" />
        {modelCount !== undefined && modelCount > 0 ? (
          <Badge variant="neutral" size={18}>
            {hu.settings.cloudModelCount(modelCount)}
          </Badge>
        ) : null}
        {testProvider.isPending ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
            <Spinner size={13} />
            {hu.settings.cloudTesting}
          </span>
        ) : testResult ? (
          <Badge variant={testResult.ok ? "success" : "danger"} size={18}>
            {testResult.ok ? hu.settings.cloudTestOk : hu.settings.cloudTestFail}
          </Badge>
        ) : testProvider.isError ? (
          <Badge variant="danger" size={18}>
            {hu.settings.cloudTestError}
          </Badge>
        ) : null}
        <Button
          variant="secondary"
          size={28}
          disabled={testProvider.isPending}
          onClick={handleTest}
        >
          {hu.settings.cloudTestButton}
        </Button>
      </div>
    </Card>
  );
}
