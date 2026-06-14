"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { FormInput, type FormInputProps } from "./form-input";

export interface PasswordInputProps
  extends Omit<FormInputProps, "type" | "wrapperClassName"> {
  /** Accessible label for the show/hide toggle (default Hungarian). */
  toggleLabel?: { show: string; hide: string };
  /** Wrapper class for the relative container. */
  wrapperClassName?: string;
}

/**
 * Masked password field with a show/hide eye toggle. The toggle flips the input
 * `type` between `password` and `text` in place — the value never leaves the DOM
 * and stays controlled by the caller. Built on `FormInput` so error / focus
 * styling is shared.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { className, wrapperClassName, toggleLabel, error, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const labels = toggleLabel ?? {
      show: "Jelszó megjelenítése",
      hide: "Jelszó elrejtése",
    };

    return (
      <div className={cn("relative", wrapperClassName)}>
        <FormInput
          ref={ref}
          type={visible ? "text" : "password"}
          error={error}
          className={cn("pr-10", className)}
          {...props}
        />
        <IconButton
          size={28}
          aria-label={visible ? labels.hide : labels.show}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          // Pin to the right edge of the 36px field; nudged up when an error
          // message stacks below so the toggle stays aligned to the input.
          className="absolute right-1 top-1"
        >
          <Icon icon={visible ? EyeOff : Eye} size={15} />
        </IconButton>
      </div>
    );
  },
);
