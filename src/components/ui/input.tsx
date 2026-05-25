import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input Component
 *
 * A flexible text input component supporting multiple sizes and states.
 * Uses semantic tokens only - no hardcoded values.
 *
 * Sizes: sm (32px), md (40px), lg (48px)
 * States: default, focus, error, disabled
 */

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Control size - affects height, padding, and font size */
  size?: "sm" | "md" | "lg";
  /** Visual state of the input */
  state?: "default" | "error";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = "md", state = "default", disabled, ...props }, ref) => {
    // Determine the state attribute value
    const stateAttr = disabled ? "disabled" : state;

    return (
      <input
        ref={ref}
        disabled={disabled}
        data-size={size}
        data-state={stateAttr}
        className={cn(
          // Base styles
          "flex w-full appearance-none border bg-surface-raised text-foreground",
          "transition-all duration-fast ease-default",
          "placeholder:text-foreground-muted",
          "focus:outline-none",

          // Size variants
          size === "sm" && [
            "h-[var(--control-sm-height)] px-compact text-[var(--control-sm-font)]",
            "rounded-control-sm",
          ],
          size === "md" && [
            "h-[var(--control-md-height)] px-standard text-[var(--control-md-font)]",
            "rounded-control-md",
          ],
          size === "lg" && [
            "h-[var(--control-lg-height)] px-default text-[var(--control-lg-font)]",
            "rounded-control-md",
          ],

          // State: Default
          state === "default" && !disabled && [
            "border-border",
            "hover:border-border-hover",
            "focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-focus",
          ],

          // State: Error
          state === "error" && !disabled && [
            "border-error",
            "focus-visible:ring-2 focus-visible:ring-error focus-visible:border-error",
          ],

          // State: Disabled
          disabled && [
            "bg-surface-muted",
            "border-border",
            "opacity-50",
            "cursor-not-allowed",
          ],

          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
