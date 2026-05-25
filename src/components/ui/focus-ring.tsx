"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FocusRing Component
 *
 * A utility component that renders a visible focus indicator around its children.
 * Used to ensure consistent focus visibility across all interactive elements.
 *
 * Features:
 * - Consistent focus ring styling using design tokens
 * - Support for different ring variants (default, offset, error, subtle)
 * - Proper focus-visible behavior (shows on keyboard navigation, not mouse click)
 * - Accessible by default with proper ARIA attributes
 *
 * @example
 * ```tsx
 * // Standard focus ring
 * <FocusRing>
 *   <button>Click me</button>
 * </FocusRing>
 *
 * // Focus ring with offset (for buttons)
 * <FocusRing variant="offset">
 *   <button>Click me</button>
 * </FocusRing>
 *
 * // Error state focus ring
 * <FocusRing variant="error">
 *   <input aria-invalid="true" />
 * </FocusRing>
 *
 * // Subtle focus ring (for table rows, cards)
 * <FocusRing variant="subtle">
 *   <tr tabIndex={0}>Row content</tr>
 * </FocusRing>
 * ```
 */

export interface FocusRingProps {
  /**
   * The content to wrap with a focus ring
   */
  children: React.ReactElement;

  /**
   * Visual variant of the focus ring
   * - default: Standard 2px ring without offset
   * - offset: Ring with 2px offset (for buttons, links)
   * - error: Error-colored ring for invalid states
   * - subtle: Smaller offset for contained elements (rows, cards)
   * @default "default"
   */
  variant?: "default" | "offset" | "error" | "subtle";

  /**
   * Additional CSS classes to apply
   */
  className?: string;

  /**
   * Whether the focus ring is disabled
   * @default false
   */
  disabled?: boolean;
}

/**
 * Focus ring variant styles mapped to Tailwind classes
 * All variants use focus-visible to avoid showing on mouse click
 */
const focusRingVariants = {
  default: [
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-border-focus",
  ],
  offset: [
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-border-focus",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-surface-raised",
  ],
  error: [
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-error",
  ],
  subtle: [
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-border-focus",
    "focus-visible:ring-offset-1",
    "focus-visible:ring-offset-surface",
  ],
};

/**
 * FocusRing component - Wraps children with consistent focus indicator
 *
 * @component
 */
const FocusRing = React.forwardRef<HTMLElement, FocusRingProps>(
  ({ children, variant = "default", className, disabled = false }, ref) => {
    // Get the focus ring classes for the selected variant
    const focusClasses = disabled ? "" : cn(focusRingVariants[variant]);

    // Clone the child element and merge the focus classes
    const child = React.Children.only(children) as React.ReactElement<{
      className?: string;
      [key: string]: unknown;
    }>;

    const childProps = child.props || {};

    return React.cloneElement(child, {
      ...childProps,
      className: cn(focusClasses, childProps.className, className),
      ref,
    });
  }
);

FocusRing.displayName = "FocusRing";

export { FocusRing };

/**
 * Standalone focus ring class names for direct use with cn()
 * Use these when you don't need the wrapper component
 *
 * @example
 * ```tsx
 * <button className={cn(buttonStyles, focusRingVariants.offset)}>
 *   Click me
 * </button>
 * ```
 */
export { focusRingVariants };
