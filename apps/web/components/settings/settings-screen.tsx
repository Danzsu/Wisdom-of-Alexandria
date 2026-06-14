"use client";

import { useState } from "react";
import { SettingsHub } from "./settings-hub";
import { LocalSubpage } from "./local-subpage";
import { CloudSubpage } from "./cloud-subpage";
import { McpSubpage } from "./mcp-subpage";
import type { SettingsSubpage } from "./types";

/**
 * Beállítások screen (the `beallitasok` route body). A single client view that
 * switches between the hub and the three provider subpages (Local MVP-real,
 * Cloud V1 stub, MCP V2 stub). The Generálás params (Temperature / Max tokenek)
 * live on the hub and persist client-side; the AI calls read them.
 */
export function SettingsScreen() {
  const [subpage, setSubpage] = useState<SettingsSubpage>("hub");
  const back = () => setSubpage("hub");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-12">
      <div className="mx-auto max-w-[600px]">
        {subpage === "hub" ? <SettingsHub onNavigate={setSubpage} /> : null}
        {subpage === "local" ? <LocalSubpage onBack={back} /> : null}
        {subpage === "cloud" ? <CloudSubpage onBack={back} /> : null}
        {subpage === "mcp" ? <McpSubpage onBack={back} /> : null}
      </div>
    </div>
  );
}
