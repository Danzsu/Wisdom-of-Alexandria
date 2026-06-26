import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { FAROSZ_BOOK, FAROSZ_PROJECT } from "@/test/msw/fixtures";
import { expectNoA11yViolations } from "@/test/a11y";
import { hu } from "@/lib/i18n/hu";

const base = `${API_BASE_URL}/api/v1`;
const sgUrl = `${base}/projects/${FAROSZ_PROJECT.id}/style-guide`;

// Mock the route param the screen reads.
let params: Record<string, string | undefined> = { bookId: FAROSZ_BOOK.id };
const navigate = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => params,
}));
vi.mock("@/lib/use-nav-to", () => ({
  useNavTo: () => navigate,
}));

import { StyleGuideScreen } from "../style-guide-screen";

/** A fully-populated style guide covering every design section. */
const FULL_STYLE_GUIDE = {
  id: "5917e000-0000-0000-0000-000000000001",
  project_id: FAROSZ_PROJECT.id,
  tone: "Lírai",
  pov: "Közeli E/3",
  tense: "Múlt idő",
  rules: {
    pillars: [
      {
        key: "Mondatritmus",
        value: "Hosszú, lélegző",
        description: "Alárendelt mellékmondatok, ritka pont.",
      },
      {
        key: "Képi világ",
        value: "Tengeri fény",
        description: "Só, köd és a fárosz visszfénye ismétlődik.",
      },
    ],
    do: ["Használj konkrét érzéki részleteket", "Tartsd meg a magázódást"],
    dont: ["Kerüld a modern szlenget", "Ne magyarázd túl az érzelmeket"],
    banned: ["hirtelen", "valahogy", "gyönyörű"],
  },
  examples: {
    sample:
      "A világítótorony fénye lassan végigsöpört a vízen, és Szeléné érezte a só ízét az ajkán.",
  },
  notes: "Kézzel hangolt etalon a könyvhöz.",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-20T00:00:00Z",
};

function mockStyleGuide(body: Record<string, unknown> | null, status = 200) {
  server.use(
    http.get(sgUrl, () =>
      status === 200
        ? HttpResponse.json(body)
        : HttpResponse.json({ detail: "Style guide not found" }, { status }),
    ),
  );
}

function renderScreen() {
  return render(
    <Providers>
      <StyleGuideScreen />
    </Providers>,
  );
}

describe("StyleGuideScreen", () => {
  beforeEach(() => {
    params = { bookId: FAROSZ_BOOK.id };
    navigate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the narrator voice chips from the backend tone/pov/tense", async () => {
    mockStyleGuide(FULL_STYLE_GUIDE);
    renderScreen();
    // The three typed columns become voice chips.
    expect(await screen.findByText("Lírai")).toBeInTheDocument();
    expect(screen.getByText("Közeli E/3")).toBeInTheDocument();
    expect(screen.getByText("Múlt idő")).toBeInTheDocument();
  });

  it("renders the pillar cards from rules.pillars", async () => {
    mockStyleGuide(FULL_STYLE_GUIDE);
    renderScreen();
    expect(await screen.findByText("Mondatritmus")).toBeInTheDocument();
    expect(screen.getByText("Hosszú, lélegző")).toBeInTheDocument();
    expect(
      screen.getByText("Alárendelt mellékmondatok, ritka pont."),
    ).toBeInTheDocument();
    expect(screen.getByText("Képi világ")).toBeInTheDocument();
    expect(screen.getByText("Tengeri fény")).toBeInTheDocument();
  });

  it("renders the do / don't lists from rules.do and rules.dont", async () => {
    mockStyleGuide(FULL_STYLE_GUIDE);
    renderScreen();
    expect(
      await screen.findByText("Használj konkrét érzéki részleteket"),
    ).toBeInTheDocument();
    expect(screen.getByText("Tartsd meg a magázódást")).toBeInTheDocument();
    expect(screen.getByText("Kerüld a modern szlenget")).toBeInTheDocument();
    expect(
      screen.getByText("Ne magyarázd túl az érzelmeket"),
    ).toBeInTheDocument();
  });

  it("renders the banned words from rules.banned", async () => {
    mockStyleGuide(FULL_STYLE_GUIDE);
    renderScreen();
    expect(await screen.findByText("hirtelen")).toBeInTheDocument();
    expect(screen.getByText("valahogy")).toBeInTheDocument();
    expect(screen.getByText("gyönyörű")).toBeInTheDocument();
  });

  it("renders the sample passage from examples.sample", async () => {
    mockStyleGuide(FULL_STYLE_GUIDE);
    renderScreen();
    expect(
      await screen.findByText(
        "A világítótorony fénye lassan végigsöpört a vízen, és Szeléné érezte a só ízét az ajkán.",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to notes for the sample when examples.sample is absent", async () => {
    mockStyleGuide({
      ...FULL_STYLE_GUIDE,
      examples: {},
      notes: "Tartalék etalon a jegyzetekből.",
    });
    renderScreen();
    expect(
      await screen.findByText("Tartalék etalon a jegyzetekből."),
    ).toBeInTheDocument();
  });

  it("omits sections that have no backing data (binding is conditional, not hardcoded)", async () => {
    mockStyleGuide({
      ...FULL_STYLE_GUIDE,
      rules: {}, // no pillars / do / dont / banned
      examples: {},
      notes: null,
    });
    renderScreen();
    // The voice chips (typed columns) still render…
    expect(await screen.findByText("Lírai")).toBeInTheDocument();
    // …but every rules/examples-backed section is absent.
    expect(screen.queryByText("Mondatritmus")).not.toBeInTheDocument();
    expect(screen.queryByText(hu.styleGuide.doTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(hu.styleGuide.dontTitle)).not.toBeInTheDocument();
    expect(
      screen.queryByText(hu.styleGuide.bannedLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(hu.styleGuide.sampleLabel),
    ).not.toBeInTheDocument();
  });

  it("shows the loading skeleton before data resolves", async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    server.use(
      http.get(sgUrl, async () => {
        await gate;
        return HttpResponse.json(FULL_STYLE_GUIDE);
      }),
    );
    renderScreen();
    expect(await screen.findByTestId("style-guide-loading")).toBeInTheDocument();
    resolve();
    expect(await screen.findByText("Lírai")).toBeInTheDocument();
  });

  it("surfaces the edit action (read-only slice — honest stub) on a populated guide", async () => {
    mockStyleGuide(FULL_STYLE_GUIDE);
    const user = userEvent.setup();
    renderScreen();
    const editBtn = await screen.findByRole("button", {
      name: hu.styleGuide.editCta,
    });
    await user.click(editBtn);
    expect(
      await screen.findByText(hu.styleGuide.editStubToast),
    ).toBeInTheDocument();
  });

  it("shows the empty state with a create CTA when the guide is missing (404)", async () => {
    mockStyleGuide(null, 404);
    renderScreen();
    expect(
      await screen.findByText("Még nincs stíluskalauz"),
    ).toBeInTheDocument();
  });

  it("shows an error state when the guide fails to load (non-404)", async () => {
    mockStyleGuide(null, 500);
    renderScreen();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("has no accessibility violations with a populated guide", async () => {
    mockStyleGuide(FULL_STYLE_GUIDE);
    const { container } = renderScreen();
    await screen.findByText("Lírai");
    await expectNoA11yViolations(container);
  });
});
