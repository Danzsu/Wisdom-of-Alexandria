import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { RagIndexSection } from "@/components/settings/rag-index-section";
import { FAROSZ_BOOK, makeIndexJob } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";

const aiBase = `${AI_BASE_URL}/api/v1`;

// The card reads the book id from the route; the index is then resolved to the
// owning project via the (MSW-backed) book→project lookup.
vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id }),
}));

describe("RagIndexSection", () => {
  it("rebuilds the index and renders the done counts", async () => {
    renderWithProviders(<RagIndexSection />);

    const button = await screen.findByRole("button", {
      name: hu.settings.ragIndexButtonAria,
    });
    // Enabled once the book → project id resolves.
    await waitFor(() => expect(button).toBeEnabled());

    await userEvent.click(button);

    // The default handlers resolve the job to DONE with counts (indexed 3 / skipped 2).
    await waitFor(() =>
      expect(
        screen.getByText(
          hu.settings.ragIndexDone({
            indexed: 3,
            updated: 1,
            deleted: 0,
            skipped: 2,
          }),
        ),
      ).toBeInTheDocument(),
    );
  });

  it("shows the no-provider notice when RAG is unconfigured", async () => {
    server.use(
      http.post(`${aiBase}/ai/index/async`, () =>
        HttpResponse.json(makeIndexJob("pending"), { status: 202 }),
      ),
      http.get(`${aiBase}/jobs/:jobId`, ({ params }) =>
        HttpResponse.json(
          makeIndexJob(
            "done",
            {
              indexed: 0,
              updated: 0,
              deleted: 0,
              skipped: 0,
              skipped_no_provider: true,
            },
            String(params.jobId),
          ),
        ),
      ),
    );
    renderWithProviders(<RagIndexSection />);

    const button = await screen.findByRole("button", {
      name: hu.settings.ragIndexButtonAria,
    });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    await waitFor(() =>
      expect(
        screen.getByText(hu.settings.ragIndexNoProvider),
      ).toBeInTheDocument(),
    );
  });

  it("shows the error notice when the index job fails", async () => {
    server.use(
      http.post(`${aiBase}/ai/index/async`, () =>
        HttpResponse.json(makeIndexJob("pending"), { status: 202 }),
      ),
      http.get(`${aiBase}/jobs/:jobId`, ({ params }) =>
        HttpResponse.json(makeIndexJob("failed", null, String(params.jobId))),
      ),
    );
    renderWithProviders(<RagIndexSection />);

    const button = await screen.findByRole("button", {
      name: hu.settings.ragIndexButtonAria,
    });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    await waitFor(() =>
      expect(screen.getByText(hu.settings.ragIndexError)).toBeInTheDocument(),
    );
  });
});
