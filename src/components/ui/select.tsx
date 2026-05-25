import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Select Component
 *
 * A dropdown select component supporting multiple sizes and states.
 * Uses semantic tokens only - no hardcoded values.
 *
 * Sizes: sm (32px), md (40px), lg (48px)
 * States: default, focus, error, disabled
 */

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Control size - affects height, padding, and font size */
  size?: "sm" | "md" | "lg";
  /** Visual state of the select */
  state?: "default" | "error";
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size = "md", state = "default", disabled, children, ...props }, ref) => {
    // Determine the state attribute value
    const stateAttr = disabled ? "disabled" : state;

    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          data-size={size}
          data-state={stateAttr}
          className={cn(
            // Base styles
            "flex w-full appearance-none border bg-surface-raised text-foreground",
            "transition-all duration-fast ease-default",
            "focus:outline-none",
            "cursor-pointer",

            // Size variants
            size === "sm" && [
              "h-[var(--control-sm-height)] pl-compact pr-[28px] text-[var(--control-sm-font)]",
              "rounded-control-sm",
            ],
            size === "md" && [
              "h-[var(--control-md-height)] pl-standard pr-[32px] text-[var(--control-md-font)]",
              "rounded-control-md",
            ],
            size === "lg" && [
              "h-[var(--control-lg-height)] pl-default pr-[40px] text-[var(--control-lg-font)]",
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
        >
          {children}
        </select>

        {/* Custom dropdown arrow */}
        <svg
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none",
            "text-foreground-secondary",
            size === "sm" && "w-4 h-4",
            size === "md" && "w-4 h-4",
            size === "lg" && "w-5 h-5",
            disabled && "opacity-50"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
