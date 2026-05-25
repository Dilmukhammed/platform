"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Checkbox Component
 *
 * An accessible checkbox supporting checked, unchecked, and indeterminate states.
 * Uses semantic tokens only - no hardcoded values.
 *
 * Features:
 * - Three states: checked, unchecked, indeterminate
 * - Full keyboard support (Space to toggle)
 * - Screen reader accessible (role="checkbox", aria-checked)
 * - Optional label with proper association
 * - Disabled state support
 */

export interface CheckboxProps {
  /** Current checked state */
  checked: boolean;
  /** Callback when checked state changes */
  onChange: (checked: boolean) => void;
  /** Indeterminate state (overrides checked visually) */
  indeterminate?: boolean;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Optional label text */
  label?: string;
  /** HTML id for the checkbox (auto-generated if not provided) */
  id?: string;
  /** Additional CSS classes */
  className?: string;
}

const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>(
  (
    {
      checked,
      onChange,
      indeterminate = false,
      disabled = false,
      label,
      id: providedId,
      className,
    },
    ref
  ) => {
    // Generate a unique ID if not provided (hook-safe pattern)
    const generatedId = React.useId();
    const id = providedId ?? generatedId;

    // Determine the aria-checked value
    const ariaChecked = indeterminate ? "mixed" : checked;

    // Handle keyboard interaction
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        onChange(!checked);
      }
    };

    // Handle click interaction
    const handleClick = () => {
      if (!disabled) {
        onChange(!checked);
      }
    };

    return (
      <div className={cn("inline-flex items-center gap-compact", className)}>
        {/* Checkbox control */}
        <div
          ref={ref}
          role="checkbox"
          id={id}
          aria-checked={ariaChecked}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          data-state={indeterminate ? "indeterminate" : checked ? "checked" : "unchecked"}
          data-disabled={disabled}
          className={cn(
            // Base styles
            "flex items-center justify-center",
            "w-[var(--control-md-height)] h-[var(--control-md-height)]",
            "rounded-control-sm",
            "border-2",
            "transition-all duration-fast ease-default",
            "cursor-pointer",
            "focus:outline-none",

            // Unchecked state
            !checked && !indeterminate && [
              "bg-surface-raised",
              "border-border",
              "hover:border-border-hover",
            ],

            // Checked or indeterminate state
            (checked || indeterminate) && [
              "bg-primary",
              "border-primary",
            ],

            // Focus ring
            !disabled && [
              "focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
            ],

            // Disabled state
            disabled && [
              "bg-surface-muted",
              "border-border",
              "opacity-50",
              "cursor-not-allowed",
            ]
          )}
        >
          {/* Checkmark icon (shown when checked) */}
          {checked && !indeterminate && (
            <svg
              className="w-[var(--control-icon-md)] h-[var(--control-icon-md)] text-foreground-inverse"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}

          {/* Indeterminate dash icon */}
          {indeterminate && (
            <svg
              className="w-[var(--control-icon-md)] h-[var(--control-icon-md)] text-foreground-inverse"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </div>

        {/* Optional label */}
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "text-[var(--control-md-font)] text-foreground",
              "cursor-pointer",
              "select-none",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
