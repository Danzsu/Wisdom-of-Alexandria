import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { resetProviderStore } from "@/test/msw/handlers";
import { PROVIDER_OLLAMA } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";
import { LocalSubpage } from "../local-subpage";

const base = `${AI_BASE_URL}/api/v1`;
const PULL_URL = `${base}/providers/${PROVIDER_OLLAMA.id}/models/pull`;

function renderLocal() {
  return render(
    <Providers>
      <LocalSubpage onBack={vi.fn()} />
    </Providers>,
  );
}

/** Build an NDJSON streaming Response from a list of progress objects. */
function ndjsonStream(lines: object[]) {
  const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new HttpResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

describe("LocalSubpage — Ollama model download (pull)", () => {
  beforeEach(() => resetProviderStore());

  it("renders the download section with the model-name input + button", async () => {
    renderLocal();
    expect(
      await screen.findByText(hu.settings.modelPull.title),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(hu.settings.modelPull.label),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(hu.settings.modelPull.button) }),
    ).toBeInTheDocument();
  });

  it("streams progress then toasts success and refetches models", async () => {
    server.use(
      http.post(PULL_URL, () =>
        ndjsonStream([
          { status: "pulling manifest" },
          { status: "downloading", completed: 50, total: 100 },
          { status: "success" },
        ]),
      ),
    );
    renderLocal();

    const input = await screen.findByLabelText(hu.settings.modelPull.label);
    await userEvent.type(input, "llama3.1:8b");
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(hu.settings.modelPull.button) }),
    );

    // The success toast carries the model name.
    await waitFor(() =>
      expect(
        screen.getByText(hu.settings.modelPull.success("llama3.1:8b")),
      ).toBeInTheDocument(),
    );
  });

  it("surfaces an error toast when the pull fails (non-Ollama / Ollama down)", async () => {
    server.use(
      http.post(PULL_URL, () =>
        HttpResponse.json(
          { detail: "Nem sikerült letölteni a modellt az Ollama-tól." },
          { status: 502 },
        ),
      ),
    );
    renderLocal();

    const input = await screen.findByLabelText(hu.settings.modelPull.label);
    await userEvent.type(input, "llama3.1:8b");
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(hu.settings.modelPull.button) }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Nem sikerült letölteni a modellt az Ollama-tól."),
      ).toBeInTheDocument(),
    );
  });
});
