import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormInput } from "@/components/kit/form-input";

describe("FormInput", () => {
  it("renders an input with the base field classes", () => {
    render(<FormInput placeholder="Név" />);
    const input = screen.getByPlaceholderText("Név");
    expect(input).toHaveClass("h-9");
    expect(input.className).toContain("bg-surface");
    expect(input.className).toContain("border-border");
  });

  it("sets aria-invalid and danger border when error is true", () => {
    render(<FormInput aria-label="mező" error />);
    const input = screen.getByLabelText("mező");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("border-danger");
  });

  it("renders a role=alert message and wires aria-describedby for a string error", () => {
    render(<FormInput aria-label="mező" error="Kötelező mező" />);
    const input = screen.getByLabelText("mező");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Kötelező mező");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toEqual(alert.id);
  });

  it("does not set aria-invalid when there is no error", () => {
    render(<FormInput aria-label="mező" />);
    expect(screen.getByLabelText("mező")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders prefix and suffix adornments", () => {
    render(
      <FormInput
        aria-label="Ár"
        prefix={<span>Ft</span>}
        suffix={<span>/db</span>}
      />,
    );
    expect(screen.getByText("Ft")).toBeInTheDocument();
    expect(screen.getByText("/db")).toBeInTheDocument();
    // The actual input is still labelled and accessible
    expect(screen.getByLabelText("Ár")).toBeInTheDocument();
  });

  it("error/aria-invalid still wired when prefix+suffix are present", () => {
    render(
      <FormInput
        aria-label="Ár"
        prefix={<span>Ft</span>}
        suffix={<span>/db</span>}
        error="Kötelező"
      />,
    );
    const input = screen.getByLabelText("Ár");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Kötelező");
  });

  it("aria-describedby still wired to error message with slots present", () => {
    render(
      <FormInput
        aria-label="Ár"
        prefix={<span>Ft</span>}
        error="Kötelező mező"
      />,
    );
    const input = screen.getByLabelText("Ár");
    const alert = screen.getByRole("alert");
    expect(input.getAttribute("aria-describedby")).toEqual(alert.id);
  });
});
