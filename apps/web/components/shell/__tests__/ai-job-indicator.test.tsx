import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hu } from "@/lib/i18n/hu";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/konyv/demo/terv",
}));

// Drive the two B1 counts directly so each state is deterministic.
let activeCount = 0;
let failedCount = 0;
vi.mock("@/lib/api/ai-hooks", () => ({
  useActiveJobCount: () => activeCount,
  useFailedJobCount: () => failedCount,
}));

import { AiJobIndicator } from "../ai-job-indicator";

describe("AiJobIndicator", () => {
  afterEach(() => {
    activeCount = 0;
    failedCount = 0;
    push.mockClear();
  });

  it("renders the working pill when jobs are running", () => {
    activeCount = 2;
    render(<AiJobIndicator bookId="demo" />);
    expect(screen.getByText(hu.statusbar.aiWorking)).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: hu.statusbar.aiWorkingAria(2) }),
    ).toBeInTheDocument();
  });

  it("renders the failed count (and links to feladatok) when jobs failed", async () => {
    failedCount = 3;
    render(<AiJobIndicator bookId="demo" />);
    const btn = screen.getByRole("button", {
      name: hu.statusbar.aiFailedAria(3),
    });
    expect(btn).toHaveTextContent(hu.statusbar.aiFailed(3));
    await userEvent.click(btn);
    expect(push).toHaveBeenCalledWith("/konyv/demo/feladatok");
  });

  it("prefers the working state over failed when both are present", () => {
    activeCount = 1;
    failedCount = 2;
    render(<AiJobIndicator bookId="demo" />);
    expect(screen.getByText(hu.statusbar.aiWorking)).toBeInTheDocument();
    expect(
      screen.queryByText(hu.statusbar.aiFailed(2)),
    ).not.toBeInTheDocument();
  });

  it("renders NOTHING when idle (honest)", () => {
    const { container } = render(<AiJobIndicator bookId="demo" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing without a book id", () => {
    activeCount = 5;
    const { container } = render(<AiJobIndicator bookId={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
