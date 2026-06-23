import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { ResearchScreen } from "@/components/research/research-screen";
import { FAROSZ_BOOK, makeResearchResult } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";

const aiBase = `${AI_BASE_URL}/api/v1`;

async function ask(question: string) {
  const input = await screen.findByRole("textbox", {
    name: hu.research.questionAria,
  });
  await userEvent.type(input, question);
  await userEvent.click(screen.getByRole("button", { name: hu.research.ask }));
}

describe("ResearchScreen", () => {
  it("asks a question and renders the grounded answer + citation chips", async () => {
    renderWithProviders(<ResearchScreen bookId={FAROSZ_BOOK.id} />);
    await ask("Ki Szelene?");

    await waitFor(() =>
      expect(
        screen.getByText("Szelene a Nagykönyvtár éjszakai írnoka."),
      ).toBeInTheDocument(),
    );
    // The retrieved entity is rendered as a citation chip.
    expect(screen.getByText("Szelene")).toBeInTheDocument();
    expect(screen.getByText(hu.research.citationsLabel)).toBeInTheDocument();
  });

  it("shows the no-context note when RAG returned no citations", async () => {
    server.use(
      http.post(`${aiBase}/ai/research`, () =>
        HttpResponse.json(makeResearchResult("Válasz kontextus nélkül.", [])),
      ),
    );
    renderWithProviders(<ResearchScreen bookId={FAROSZ_BOOK.id} />);
    await ask("Kérdés");

    await waitFor(() =>
      expect(screen.getByText(hu.research.noCitations)).toBeInTheDocument(),
    );
  });

  it("surfaces an error via ErrorState (role=alert, not swallowed)", async () => {
    server.use(
      http.post(`${aiBase}/ai/research`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 502 }),
      ),
    );
    renderWithProviders(<ResearchScreen bookId={FAROSZ_BOOK.id} />);
    await ask("Kérdés");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(screen.getByText(hu.research.errorRetry)).toBeInTheDocument();
  });

  it("retry button on ErrorState resets the error so a new question can be asked", async () => {
    server.use(
      http.post(`${aiBase}/ai/research`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 502 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ResearchScreen bookId={FAROSZ_BOOK.id} />);
    await ask("Kérdés");

    // Error state must appear.
    await screen.findByRole("alert");

    // Restore success handler before retry.
    server.resetHandlers();

    // Click retry — the mutation resets, error disappears, form is usable again.
    await user.click(screen.getByRole("button", { name: hu.common.retry }));

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    // The input is still accessible so the user can re-ask.
    expect(
      screen.getByRole("textbox", { name: hu.research.questionAria }),
    ).toBeInTheDocument();
  });
});
