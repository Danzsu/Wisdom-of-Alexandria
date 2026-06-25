/**
 * Cross-resource integration test for the create → write flow.
 *
 * Drives the New-book Wizard through all three steps and submits, then asserts
 * the nested backend contract is honoured end-to-end:
 *   1. POST /projects fires FIRST, then POST /projects/{id}/books — IN ORDER.
 *   2. The book is created under the RETURNED project id (nested correctly).
 *   3. The payloads match the MVP contract: author/pov/audience are knowingly
 *      ABSENT (no MVP field), style is mapped to the book synopsis, the length
 *      token maps to word_count_target, and the project description is null
 *      (genre is NOT written into the project description).
 *   4. Post-submit navigation targets the RETURNED book id (`/konyv/{id}/terv`),
 *      never a fabricated demo id, and never the project id in the book segment.
 *
 * This FAILS against the old behaviour (project description = genre; nav using a
 * project id / demo id) and PASSES after the fix.
 */
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { hu } from "@/lib/i18n/hu";
import { NewBookWizard } from "@/components/projects/new-book-wizard";

const base = `${API_BASE_URL}/api/v1`;

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}));

const RETURNED_PROJECT_ID = "proj-aaaa-1111";
const RETURNED_BOOK_ID = "book-bbbb-2222";

interface RecordedCall {
  kind: "project" | "book";
  projectIdInPath?: string;
  body: Record<string, unknown>;
}

/** Install stateful, in-order-recording handlers for the create flow. */
function installRecordingHandlers(): RecordedCall[] {
  const calls: RecordedCall[] = [];

  server.use(
    http.post(`${base}/projects`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.push({ kind: "project", body });
      return HttpResponse.json(
        {
          id: RETURNED_PROJECT_ID,
          title: body.title ?? "Névtelen projekt",
          description: (body.description as string | null) ?? null,
          language: (body.language as string) ?? "hu",
          created_at: "2026-06-14T15:00:00Z",
          updated_at: "2026-06-14T15:00:00Z",
          // Feature #1: the backend returns zero aggregates on create.
          book_count: 0,
          word_count: 0,
          scene_count: 0,
        },
        { status: 201 },
      );
    }),
    http.post(`${base}/projects/:pid/books`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.push({
        kind: "book",
        projectIdInPath: String(params.pid),
        body,
      });
      return HttpResponse.json(
        {
          id: RETURNED_BOOK_ID,
          project_id: String(params.pid),
          series_id: null,
          title: body.title ?? "Névtelen könyv",
          description: (body.description as string | null) ?? null,
          synopsis: (body.synopsis as string | null) ?? null,
          genre: (body.genre as string | null) ?? null,
          language: (body.language as string) ?? "hu",
          word_count_target: (body.word_count_target as number | null) ?? null,
          order_index: (body.order_index as number) ?? 0,
          author: (body.author as string | null) ?? null,
          created_at: "2026-06-14T15:00:00Z",
          updated_at: "2026-06-14T15:00:00Z",
        },
        { status: 201 },
      );
    }),
  );

  return calls;
}

/** Walk the wizard: title → style note → submit. */
async function driveWizard(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText(hu.wizard.titleLabel),
    "Az alexandriai hajnal",
  );
  // Step 1 → 2.
  await user.click(screen.getByRole("button", { name: hu.wizard.next }));
  expect(await screen.findByText(hu.wizard.step2Eyebrow)).toBeInTheDocument();
  // Add a style note so we can assert style → synopsis mapping.
  await user.type(
    screen.getByLabelText(hu.wizard.styleLabel),
    "lassú építkezés",
  );
  // Step 2 → 3.
  await user.click(screen.getByRole("button", { name: hu.wizard.next }));
  expect(await screen.findByText(hu.wizard.step3Eyebrow)).toBeInTheDocument();
  // Submit.
  await user.click(screen.getByRole("button", { name: hu.wizard.create }));
}

describe("create-book flow (integration)", () => {
  it("creates project then book IN ORDER with the correct nested payloads", async () => {
    const user = userEvent.setup();
    pushMock.mockClear();
    const calls = installRecordingHandlers();

    renderWithProviders(<NewBookWizard open onOpenChange={() => {}} />);
    await driveWizard(user);

    // Both calls fire, in order.
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[0].kind).toBe("project");
    expect(calls[1].kind).toBe("book");

    // The book is nested under the RETURNED project id.
    expect(calls[1].projectIdInPath).toBe(RETURNED_PROJECT_ID);

    // Project payload: description is null (genre is NOT a project description).
    const projectBody = calls[0].body;
    expect(projectBody.title).toBe("Az alexandriai hajnal");
    expect(projectBody.description).toBeNull();
    expect(projectBody.language).toBe("hu");

    // Book payload: genre on the book, style → synopsis, length → word_count.
    const bookBody = calls[1].body;
    expect(bookBody.title).toBe("Az alexandriai hajnal");
    expect(bookBody.genre).toBe(hu.genres[0]);
    expect(bookBody.synopsis).toBe("lassú építkezés");
    expect(bookBody.word_count_target).toBe(80000);
    expect(bookBody.order_index).toBe(0);

    // author / pov / audience are knowingly ABSENT — no MVP field exists.
    expect(bookBody).not.toHaveProperty("author");
    expect(bookBody).not.toHaveProperty("pov");
    expect(bookBody).not.toHaveProperty("audience");
    expect(projectBody).not.toHaveProperty("author");
    expect(projectBody).not.toHaveProperty("pov");
    expect(projectBody).not.toHaveProperty("audience");
  });

  it("navigates to the RETURNED book id (never the project id / a demo id)", async () => {
    const user = userEvent.setup();
    pushMock.mockClear();
    installRecordingHandlers();

    renderWithProviders(<NewBookWizard open onOpenChange={() => {}} />);
    await driveWizard(user);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/konyv/${RETURNED_BOOK_ID}/terv`,
      ),
    );
    // Must NOT navigate using the project id in the [bookId] segment…
    expect(pushMock).not.toHaveBeenCalledWith(
      `/konyv/${RETURNED_PROJECT_ID}/terv`,
    );
    // …nor a fabricated demo id.
    expect(pushMock).not.toHaveBeenCalledWith("/konyv/demo/terv");
  });
});
