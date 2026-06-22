"use client";

/**
 * Book settings page (`/konyv/:bookId/beallitasok`).
 *
 * Two tabs:
 * - "Könyv" (default) — book metadata form (title / genre / author).
 * - "AI / Szolgáltatók" — the SettingsScreen provider hub
 *   (Local/Ollama, Cloud/API-keys, MCP, generation params).
 *
 * The outer tab switch uses SegmentedControl (the app's established 2-way
 * page-section switcher). SettingsScreen manages its own internal
 * Local/Cloud/MCP sub-navigation.
 */

import { useState } from "react";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { SettingsScreen } from "@/components/settings";
import { hu } from "@/lib/i18n/hu";
import { BookTab } from "./book-tab";

type Tab = "book" | "providers";

export default function BeallitasokPage() {
  const [tab, setTab] = useState<Tab>("book");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Switcher + book form share a padded, width-constrained shell. The
          providers tab renders SettingsScreen as a SIBLING (outside this shell)
          because it applies its OWN px-8/py-12/max-w container — nesting it here
          would double the padding and constraint. */}
      <div className="px-8 pt-12">
        <div className="mx-auto max-w-[600px]">
          <div className={tab === "book" ? "mb-8" : ""}>
            <SegmentedControl<Tab>
              aria-label="Beállítások szekció"
              options={[
                { value: "book", label: hu.books.tabBook },
                { value: "providers", label: hu.books.tabProviders },
              ]}
              value={tab}
              onValueChange={setTab}
            />
          </div>

          {/* Könyv tab — book metadata form */}
          {tab === "book" ? <BookTab /> : null}
        </div>
      </div>

      {/* AI / Szolgáltatók tab — provider hub (self-padded) */}
      {tab === "providers" ? <SettingsScreen /> : null}
    </div>
  );
}
