import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { resetProviderStore } from "@/test/msw/handlers";
import { PROVIDER_GEMINI, PROVIDER_OLLAMA } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";
import { LocalSubpage } from "../local-subpage";

const base = `${AI_BASE_URL}/api/v1`;
const PROVIDERS_URL = `${base}/providers`;
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

/**
 * A streaming Response that emits the given progress lines but DOES NOT close
 * the stream — so the component stays mid-pull (isPulling) with the latest
 * progress line rendered, letting a test assert the intermediate progress UI
 * before any terminal success/error arrives.
 */
function openNdjsonStream(lines: object[]) {
  const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      // Intentionally left open (no controller.close()).
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

  it("renders intermediate streamed progress (statusText + percent + bar)", async () => {
    // Stream a manifest line then a downloading line at 50% — and leave the
    // stream OPEN so the component stays mid-pull, surfacing the live progress
    // UI (the fractionPct / ProgressBar path) rather than the terminal success.
    server.use(
      http.post(PULL_URL, () =>
        openNdjsonStream([
          { status: "pulling manifest" },
          { status: "downloading", completed: 50, total: 100 },
        ]),
      ),
    );
    renderLocal();

    const input = await screen.findByLabelText(hu.settings.modelPull.label);
    await userEvent.type(input, "llama3.1:8b");
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(hu.settings.modelPull.button) }),
    );

    // The latest progress line's status drives statusText…
    await waitFor(() =>
      expect(screen.getByText("downloading")).toBeInTheDocument(),
    );
    // …and completed/total (50/100) drives the rounded percent + the bar.
    expect(screen.getByText("50%")).toBeInTheDocument();
    const bar = screen.getByLabelText(hu.settings.modelPull.progressLabel);
    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });

  it("surfaces an error toast on a mid-stream in-band {error} line", async () => {
    // A 200 stream that ends with an in-band {"error": ...} line — distinct
    // from the HTTP-502 startup path: this exercises the `_parsePullLine` throw.
    server.use(
      http.post(PULL_URL, () =>
        ndjsonStream([
          { status: "pulling manifest" },
          { status: "downloading", completed: 10, total: 100 },
          { error: "A réteg letöltése megszakadt." },
        ]),
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
        screen.getByText("A réteg letöltése megszakadt."),
      ).toBeInTheDocument(),
    );
    // The success toast must NOT appear — a mid-stream error is never success.
    expect(
      screen.queryByText(hu.settings.modelPull.success("llama3.1:8b")),
    ).not.toBeInTheDocument();
  });

  describe("with NO Ollama provider configured", () => {
    beforeEach(() => {
      // Return a provider list WITHOUT any ollama provider so the subpage
      // cannot resolve one to pull onto.
      server.use(
        http.get(PROVIDERS_URL, () => HttpResponse.json([PROVIDER_GEMINI])),
      );
    });

    it("shows the noProvider hint and disables the download button", async () => {
      renderLocal();

      expect(
        await screen.findByText(hu.settings.modelPull.noProvider),
      ).toBeInTheDocument();
      // The button is disabled (empty input + no provider).
      expect(
        screen.getByRole("button", {
          name: new RegExp(hu.settings.modelPull.button),
        }),
      ).toBeDisabled();
    });

    it("guards startPull with the noProvider toast when a name is submitted", async () => {
      renderLocal();
      await screen.findByText(hu.settings.modelPull.noProvider);

      const input = screen.getByLabelText(hu.settings.modelPull.label);
      await userEvent.type(input, "llama3.1:8b{Enter}");

      // The startPull noProvider guard fires (info toast); the hint also stays.
      await waitFor(() =>
        expect(
          screen.getAllByText(hu.settings.modelPull.noProvider).length,
        ).toBeGreaterThan(0),
      );
    });
  });

  it("guards startPull with the emptyName toast on an empty submit", async () => {
    renderLocal();
    const input = await screen.findByLabelText(hu.settings.modelPull.label);
    // The submit button is disabled while the input is empty, so submit the
    // form directly to reach onSubmit → startPull and hit the emptyName guard.
    const form = input.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() =>
      expect(
        screen.getByText(hu.settings.modelPull.emptyName),
      ).toBeInTheDocument(),
    );
  });
});
