/**
 * Kapcsolatok tab (codex detail) — component tests over the real MSW path.
 *
 * Mutation-proofing notes:
 * - The both-direction test seeds an outgoing + an incoming + an UNRELATED
 *   relation and pins the exact row count, so a filter that drops a direction
 *   (or forgets to filter at all) fails.
 * - The create test captures the EXACT POST payload (deep equality) via MSW
 *   events while the stateful store still serves the request — so both the
 *   payload contract and the invalidation round-trip are asserted.
 * - The delete test pins the exact DELETE URL (right relation id).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  resetCodexStore,
  resetProgressionStore,
  resetRelationStore,
} from "@/test/msw/handlers";
import {
  FAROSZ_BOOK,
  FAROSZ_PROJECT,
  FAROSZ_RELATIONS,
} from "@/test/msw/fixtures";
import { expectNoA11yViolations } from "@/test/a11y";
import { CodexDetail } from "@/components/codex/codex-detail";
import type { CodexEntryRead, CodexRelationRead } from "@/lib/api/types";
import { hu } from "@/lib/i18n/hu";

const base = `${API_BASE_URL}/api/v1`;

const SZELENE: CodexEntryRead = {
  id: "codex-szelene",
  project_id: FAROSZ_PROJECT.id,
  series_id: null,
  title: "Szelene",
  entry_type: "character",
  content: "A Nagykönyvtár éjszakai írnoka.",
  aliases: ["Lené"],
  role: "Protagonista",
  ai_visible: true,
  tags: [],
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

/** An INCOMING relation (Szelene is the target). */
const INCOMING: CodexRelationRead = {
  id: "rel-incoming",
  project_id: FAROSZ_PROJECT.id,
  from_entity_type: "location",
  from_entity_id: "codex-nagykonyvtar",
  to_entity_type: "character",
  to_entity_id: "codex-szelene",
  relation_type: "menedéke",
  description: null,
  created_at: "2026-06-14T16:00:00Z",
  updated_at: "2026-06-14T16:00:00Z",
};

/** A relation NOT touching Szelene — must never render on her tab. */
const UNRELATED: CodexRelationRead = {
  id: "rel-unrelated",
  project_id: FAROSZ_PROJECT.id,
  from_entity_type: "location",
  from_entity_id: "codex-nagykonyvtar",
  to_entity_type: "character",
  to_entity_id: "codex-deleted-mentor",
  relation_type: "szomszédja",
  description: null,
  created_at: "2026-06-14T16:00:00Z",
  updated_at: "2026-06-14T16:00:00Z",
};

/**
 * Capture request bodies via MSW events WITHOUT overriding the handler, so the
 * stateful store still processes the request (payload + round-trip in one test).
 */
function captureBodies(method: string, pathIncludes: string): unknown[] {
  const bodies: unknown[] = [];
  server.events.on("request:start", ({ request }) => {
    if (
      request.method === method &&
      new URL(request.url).pathname.includes(pathIncludes)
    ) {
      void request
        .clone()
        .json()
        .then((body) => bodies.push(body));
    }
  });
  return bodies;
}

/** Capture matching request URLs (for body-less DELETEs). */
function captureUrls(method: string, pathIncludes: string): string[] {
  const urls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    if (
      request.method === method &&
      new URL(request.url).pathname.includes(pathIncludes)
    ) {
      urls.push(new URL(request.url).pathname);
    }
  });
  return urls;
}

async function renderRelationsTab() {
  const user = userEvent.setup();
  const view = render(
    <Providers>
      <CodexDetail
        entry={SZELENE}
        projectId={FAROSZ_PROJECT.id}
        bookId={FAROSZ_BOOK.id}
        onDeleted={vi.fn()}
      />
    </Providers>,
  );
  await user.click(screen.getByRole("tab", { name: hu.codex.tabRelations }));
  return { user, view };
}

describe("CodexDetail — Kapcsolatok tab", () => {
  beforeEach(() => {
    resetCodexStore();
    resetRelationStore();
    resetProgressionStore();
  });
  afterEach(() => server.events.removeAllListeners());

  it("lists the entry's relations with the OTHER entity's name (default store)", async () => {
    await renderRelationsTab();

    // FAROSZ_RELATIONS: two outgoing rows from Szelene.
    const list = await screen.findByRole("list", {
      name: hu.codexRelations.listAria,
    });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    // Row 1: the OTHER endpoint (Nagykönyvtár), never Szelene herself.
    expect(within(rows[0]).getByText("Nagykönyvtár")).toBeInTheDocument();
    expect(within(rows[0]).getByText("őrzője")).toBeInTheDocument();
    expect(within(rows[0]).queryByText("Szelene")).not.toBeInTheDocument();
    // Row 2: the referenced entity no longer exists → muted fallback.
    expect(
      within(rows[1]).getByText(hu.codexRelations.missingEntity),
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText("mentora")).toBeInTheDocument();
  });

  it("lists BOTH directions (source and target) and excludes unrelated relations", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/codex-relations`, () =>
        HttpResponse.json([FAROSZ_RELATIONS[0], INCOMING, UNRELATED]),
      ),
    );
    await renderRelationsTab();

    const list = await screen.findByRole("list", {
      name: hu.codexRelations.listAria,
    });
    const rows = within(list).getAllByRole("listitem");
    // Exactly the outgoing + the incoming row — the unrelated one is filtered.
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Nagykönyvtár")).toBeInTheDocument();
    expect(
      within(rows[0]).getByText(hu.codexRelations.directionOutgoing),
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText("Nagykönyvtár")).toBeInTheDocument();
    expect(within(rows[1]).getByText("menedéke")).toBeInTheDocument();
    expect(
      within(rows[1]).getByText(hu.codexRelations.directionIncoming),
    ).toBeInTheDocument();
    expect(screen.queryByText("szomszédja")).not.toBeInTheDocument();
  });

  it("creates a relation: POSTs the exact payload and the new row appears (round-trip)", async () => {
    const bodies = captureBodies("POST", "/codex-relations");
    const { user } = await renderRelationsTab();

    await screen.findByRole("list", { name: hu.codexRelations.listAria });
    await user.click(
      screen.getByRole("button", { name: hu.codexRelations.addNew }),
    );

    const dialog = await screen.findByRole("dialog");
    // The from-entity is preselected to THIS entry.
    expect(
      within(dialog).getByLabelText(hu.relations.modalFromLabel),
    ).toHaveValue("codex-szelene");
    await user.selectOptions(
      within(dialog).getByLabelText(hu.relations.modalToLabel),
      "codex-nagykonyvtar",
    );
    await user.type(
      within(dialog).getByLabelText(hu.relations.modalTypeLabel),
      "látogatja",
    );
    await user.click(
      within(dialog).getByRole("button", { name: hu.relations.modalCreate }),
    );

    // EXACT payload — a mutated field name/value or a dropped field fails.
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      from_entity_type: "character",
      from_entity_id: "codex-szelene",
      to_entity_type: "location",
      to_entity_id: "codex-nagykonyvtar",
      relation_type: "látogatja",
      description: null,
    });

    // Round-trip: the stateful store persisted it and the invalidated list
    // query re-rendered the tab with the new row.
    await waitFor(() =>
      expect(screen.getByText("látogatja")).toBeInTheDocument(),
    );
  });

  it("deletes a relation: DELETEs the right id and the row disappears", async () => {
    const urls = captureUrls("DELETE", "/codex-relations");
    const { user } = await renderRelationsTab();

    const list = await screen.findByRole("list", {
      name: hu.codexRelations.listAria,
    });
    expect(within(list).getByText("őrzője")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: hu.codexRelations.deleteAria("őrzője"),
      }),
    );

    await waitFor(() => expect(urls).toHaveLength(1));
    // The EXACT relation id — deleting the other row's id fails this.
    expect(urls[0]).toBe(
      `/api/v1/projects/${FAROSZ_PROJECT.id}/codex-relations/rel-szelene-konyvtar`,
    );
    await waitFor(() =>
      expect(screen.queryByText("őrzője")).not.toBeInTheDocument(),
    );
    // The other relation survives.
    expect(screen.getByText("mentora")).toBeInTheDocument();
  });

  it("shows an empty state with a CTA that opens the create modal", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/codex-relations`, () =>
        HttpResponse.json([]),
      ),
    );
    const { user } = await renderRelationsTab();

    expect(
      await screen.findByRole("heading", {
        name: hu.codexRelations.emptyTitle,
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: hu.codexRelations.emptyCta }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("surfaces a load error and recovers on retry", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/codex-relations`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const { user } = await renderRelationsTab();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(hu.codexRelations.error);

    // Mutation-proof retry: restore the working handler — a no-op onRetry
    // never refetches, the alert persists and the list never appears.
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: hu.common.retry }));
    await waitFor(() =>
      expect(
        screen.getByRole("list", { name: hu.codexRelations.listAria }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has no a11y violations — tab content and open modal; Esc closes the dialog", async () => {
    const { user } = await renderRelationsTab();
    await screen.findByRole("list", { name: hu.codexRelations.listAria });
    await expectNoA11yViolations(document);

    await user.click(
      screen.getByRole("button", { name: hu.codexRelations.addNew }),
    );
    const dialog = await screen.findByRole("dialog");
    // Radix focus trap: focus lands inside the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true);
    await expectNoA11yViolations(document);

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
