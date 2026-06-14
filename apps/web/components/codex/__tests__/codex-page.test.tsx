import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "@/test/test-utils";
import { resetCodexStore } from "@/test/msw/handlers";
import { FAROSZ_BOOK } from "@/test/msw/fixtures";
import CodexPage from "@/app/(app)/konyv/[bookId]/codex/page";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id }),
  usePathname: () => `/konyv/${FAROSZ_BOOK.id}/codex`,
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe("Codex page (main detail area)", () => {
  beforeEach(() => {
    resetCodexStore();
    searchParams = new URLSearchParams();
  });

  it("shows the empty landing state when no entry is selected", async () => {
    render(
      <Providers>
        <CodexPage />
      </Providers>,
    );
    expect(await screen.findByText("Még üres a Codex")).toBeInTheDocument();
  });

  it("renders the selected entry's detail from the ?entry param", async () => {
    searchParams = new URLSearchParams("entry=codex-szelene");
    render(
      <Providers>
        <CodexPage />
      </Providers>,
    );
    expect(await screen.findByLabelText("Bejegyzés neve")).toHaveValue(
      "Szelene",
    );
    // Tabs of the detail are present.
    expect(screen.getByRole("tab", { name: "Részletek" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Nyomon követés" }),
    ).toBeInTheDocument();
  });
});
