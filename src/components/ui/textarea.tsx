import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea Component
 *
 * A multi-line text input component supporting multiple sizes and states.
 * Uses semantic tokens only - no hardcoded values.
 *
 * Sizes: sm (compact), md (default), lg (spacious)
 * States: default, focus, error, disabled
 */

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  /** Control size - affects padding and font size */
  size?: "sm" | "md" | "lg";
  /** Visual state of the textarea */
  state?: "default" | "error";
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, size = "md", state = "default", disabled, rows = 4, ...props },
    ref
  ) => {
    // Determine the state attribute value
    const stateAttr = disabled ? "disabled" : state;

    return (
      <textarea
        ref={ref}
        disabled={disabled}
        rows={rows}
        data-size={size}
        data-state={stateAttr}
        className={cn(
          // Base styles
          "flex w-full min-h-[80px] appearance-none border bg-surface-raised text-foreground",
          "transition-all duration-fast ease-default",
          "placeholder:text-foreground-muted",
          "focus:outline-none resize-y",

          // Size variants
          size === "sm" && [
            "px-compact py-compact text-[var(--control-sm-font)]",
            "rounded-control-sm",
          ],
          size === "md" && [
            "px-standard py-standard text-[var(--control-md-font)]",
            "rounded-control-md",
          ],
          size === "lg" && [
            "px-default py-default text-[var(--control-lg-font)]",
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
            "cursor-not-allowed resize-none",
          ],

          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
