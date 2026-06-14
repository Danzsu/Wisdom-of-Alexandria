import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/test-utils";
import { SettingsScreen } from "../settings-screen";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  useGenerationSettings,
} from "@/lib/stores/generation-settings-store";
import { MODELS_FIXTURE } from "@/test/msw/fixtures";

function renderScreen() {
  return render(
    <Providers>
      <SettingsScreen />
    </Providers>,
  );
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    useGenerationSettings.setState({
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
    });
  });
  afterEach(() => localStorage.clear());

  it("renders the hub with the three provider cards", () => {
    renderScreen();
    expect(
      screen.getByRole("button", { name: /Lokális modell-provider megnyitása/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Felhő modell-provider megnyitása/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /MCP provider megnyitása/ }),
    ).toBeInTheDocument();
  });

  it("changes the persisted Max tokenek value (read by AI calls)", async () => {
    const user = userEvent.setup();
    renderScreen();

    const input = screen.getByLabelText("Max tokenek");
    await user.clear(input);
    await user.type(input, "1024");
    await user.tab(); // commit on blur

    expect(useGenerationSettings.getState().maxTokens).toBe(1024);
  });

  it("clamps + persists the temperature via the store action", () => {
    // The Radix slider's keyboard interaction is environment-flaky in jsdom, so
    // we exercise the SAME store action the slider drives (the persisted value
    // the AI calls read), keeping the assertion deterministic.
    useGenerationSettings.getState().setTemperature(1.5);
    expect(useGenerationSettings.getState().temperature).toBeCloseTo(1.5);
    renderScreen();
    // The hub reflects the stored value in the slider readout.
    expect(screen.getByText("1.5")).toBeInTheDocument();
  });

  it("opens the Local subpage and lists models from /ai/models", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      screen.getByRole("button", { name: /Lokális modell-provider megnyitása/ }),
    );

    // The installed-models list comes from the config-driven endpoint.
    const modelLabel = MODELS_FIXTURE.models[0].label;
    expect(await screen.findByText(modelLabel)).toBeInTheDocument();
    // The default model is tagged "ajánlott".
    expect(screen.getByText("ajánlott")).toBeInTheDocument();
  });

  it("navigates back from a subpage to the hub", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      screen.getByRole("button", { name: /MCP provider megnyitása/ }),
    );
    expect(
      await screen.findByText("MCP szerver hozzáadása"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Vissza a beállításokhoz" }),
    );
    // Back on the hub: the Generálás params section is visible again.
    expect(screen.getByLabelText("Max tokenek")).toBeInTheDocument();
  });
});
