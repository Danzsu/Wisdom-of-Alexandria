import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { useUIStore } from "@/lib/stores/ui-store";
import { hu } from "@/lib/i18n/hu";
import type { ProjectRead } from "@/lib/api/types";

const base = `${API_BASE_URL}/api/v1`;

// next/navigation is module-mocked so we can assert the UserMenu's router.push
// targets without a real App Router.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Spy on the kit toast so the "Szerkesztés" stub is asserted by behaviour, not
// by a rendered element.
const toastInfo = vi.fn();
vi.mock("@/components/kit/toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/kit/toast")>();
  return {
    ...actual,
    toast: { ...actual.toast, info: (...args: unknown[]) => toastInfo(...args) },
  };
});

import { ProfileScreen } from "../profile-screen";
import { UserMenu } from "@/components/shell/user-menu";

/**
 * Two projects whose aggregates SUM to the values the stat cards must show:
 * books 2 + 3 = 5; words 40000 + 25080 = 65080 → "65 080" (hu-HU grouping).
 */
const TWO_PROJECTS: ProjectRead[] = [
  {
    id: "p1",
    title: "Első",
    description: null,
    language: "hu",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    book_count: 2,
    word_count: 40000,
  },
  {
    id: "p2",
    title: "Második",
    description: null,
    language: "hu",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    book_count: 3,
    word_count: 25080,
  },
];

function useTwoProjects() {
  server.use(
    http.get(`${base}/projects`, () => HttpResponse.json(TWO_PROJECTS)),
  );
}

function renderScreen() {
  return render(
    <Providers>
      <ProfileScreen />
    </Providers>,
  );
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    push.mockClear();
    toastInfo.mockClear();
    useUIStore.setState({ openMenu: null });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the author identity (name + initials + handle)", async () => {
    useTwoProjects();
    renderScreen();
    expect(await screen.findByText(hu.user.name)).toBeInTheDocument();
    expect(screen.getByText(hu.user.initials)).toBeInTheDocument();
    // The meta line is the handle · workspace · role triple.
    expect(
      screen.getByText(
        `${hu.profil.handle} · ${hu.profil.workspace} · ${hu.profil.role}`,
      ),
    ).toBeInTheDocument();
  });

  it("binds the SUMMED real aggregates from useProjects into the stat cards", async () => {
    useTwoProjects();
    renderScreen();
    // 2 + 3 books on the shelf.
    expect(await screen.findByText("5")).toBeInTheDocument();
    // 40000 + 25080 words. The formatter pins the contract; the card renders its
    // output. Match whitespace-agnostically so the hu-HU thousands separator
    // (regular vs narrow no-break space, ICU-build dependent) can't make this
    // assertion brittle — mirrors projects-dashboard.test.tsx.
    const expectedWords = (40000 + 25080).toLocaleString("hu-HU");
    // `\s` matches regular, no-break (U+00A0) and narrow no-break (U+202F)
    // spaces alike, so collapsing it normalizes whatever separator ICU emits.
    const collapse = (s: string) => s.replace(/\s+/g, " ");
    expect(
      screen.getByText(
        (_t, el) => collapse(el?.textContent ?? "") === collapse(expectedWords),
      ),
    ).toBeInTheDocument();
    // 2 projects (the honest substitute for the design's "jelenet" count).
    expect(screen.getByText("2")).toBeInTheDocument();
    // …with the project label, proving the third card is the project count.
    expect(screen.getByText(hu.profil.statProjects)).toBeInTheDocument();
  });

  it("shows an em dash for every stat while the aggregates are loading", () => {
    // Never-resolving handler → the query stays pending.
    server.use(
      http.get(`${base}/projects`, () => new Promise(() => {})),
    );
    const { container } = renderScreen();
    // All three stat numbers fall back to the em dash (no crash, no "0").
    const dashes = Array.from(
      container.querySelectorAll("div.font-display"),
    ).filter((el) => el.textContent === "—");
    expect(dashes).toHaveLength(3);
  });

  it("shows an em dash for every stat on a fetch error (no crash)", async () => {
    server.use(
      http.get(`${base}/projects`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const { container } = renderScreen();
    // The identity card still renders…
    expect(await screen.findByText(hu.user.name)).toBeInTheDocument();
    // …and the stats degrade to em dashes rather than throwing.
    const dashes = Array.from(
      container.querySelectorAll("div.font-display"),
    ).filter((el) => el.textContent === "—");
    expect(dashes).toHaveLength(3);
  });

  it("fires an info toast (Hamarosan) when Szerkesztés is clicked", async () => {
    useTwoProjects();
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(hu.user.name);
    await user.click(screen.getByRole("button", { name: hu.profil.edit }));
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith(hu.profil.editSoon);
  });

  it("renders the writer-settings rows (display-only)", async () => {
    useTwoProjects();
    renderScreen();
    await screen.findByText(hu.user.name);
    expect(screen.getByText(hu.profil.settingsLabel)).toBeInTheDocument();
    expect(screen.getByText(hu.profil.addressingValue)).toBeInTheDocument();
    expect(screen.getByText(hu.profil.modelValue)).toBeInTheDocument();
    expect(screen.getByText(hu.profil.goalValue)).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    useTwoProjects();
    const { container } = renderScreen();
    await screen.findByText(hu.user.name);
    await expectNoA11yViolations(container);
  });
});

describe("UserMenu wiring", () => {
  beforeEach(() => {
    push.mockClear();
    useUIStore.setState({ openMenu: null });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderMenu() {
    return render(
      <Providers>
        <UserMenu />
      </Providers>,
    );
  }

  it("navigates to /profil when Profil is clicked (and closes the menu)", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      screen.getByRole("button", { name: hu.topbar.userMenuAria }),
    );
    await user.click(await screen.findByText(hu.user.profile));
    expect(push).toHaveBeenCalledWith("/profil");
    expect(useUIStore.getState().openMenu).toBeNull();
  });

  it("navigates to / (the public landing) when Kijelentkezés is clicked", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      screen.getByRole("button", { name: hu.topbar.userMenuAria }),
    );
    await user.click(await screen.findByText(hu.user.logout));
    expect(push).toHaveBeenCalledWith("/");
    expect(useUIStore.getState().openMenu).toBeNull();
  });
});
