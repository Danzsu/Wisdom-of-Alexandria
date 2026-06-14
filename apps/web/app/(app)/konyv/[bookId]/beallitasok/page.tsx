import { SettingsScreen } from "@/components/settings";

/**
 * Beállítások route — provider hub + Local (Ollama, MVP) / Cloud (V1) / MCP
 * (V2) subpages + the client-persisted Generálás params (Temperature / Max
 * tokenek) read by the AI calls (M8). The whole screen is the client
 * {@link SettingsScreen}.
 */
export default function BeallitasokPage() {
  return <SettingsScreen />;
}
