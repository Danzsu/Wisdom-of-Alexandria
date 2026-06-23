import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { ErrorState } from "@/components/kit/error-state";
import { hu } from "@/lib/i18n/hu";

describe("ErrorState", () => {
  it("has role=alert and contains the message", () => {
    render(
      <ErrorState message="Nem sikerült betölteni a projekteket." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nem sikerült betölteni",
    );
  });

  it("renders the retry button that calls onRetry", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        message="Nem sikerült betölteni a projekteket."
        onRetry={onRetry}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Újrapróbálkozás/ }),
    );
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("retry button label is hu.common.retry", () => {
    render(
      <ErrorState message="Hiba" onRetry={() => undefined} />,
    );
    expect(
      screen.getByRole("button", { name: hu.common.retry }),
    ).toBeInTheDocument();
  });

  it("renders optional detail in muted text", () => {
    render(
      <ErrorState
        message="Szerverhiba"
        detail="Internal Server Error"
      />,
    );
    expect(screen.getByText("Internal Server Error")).toBeInTheDocument();
  });

  it("does not render a retry button when onRetry is not provided", () => {
    render(<ErrorState message="Hiba" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ErrorState accessibility", () => {
  it("is axe-clean with message only", async () => {
    const { container } = render(<ErrorState message="Hiba" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean with all props", async () => {
    const { container } = render(
      <ErrorState
        message="Nem sikerült betölteni a projekteket."
        detail="Internal Server Error"
        onRetry={() => undefined}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
