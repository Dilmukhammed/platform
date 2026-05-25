import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Badge Component
 * 
 * Small status indicator for highlighting items.
 * Uses semantic color tokens ONLY - no hardcoded hex values.
 * 
 * Variants:
 * - default: Neutral styling
 * - primary: Primary accent color
 * - success: Green for positive states
 * - warning: Amber for caution states
 * - error: Red for negative states
 * - info: Blue for informational states
 * 
 * Sizes:
 * - sm: Small badge for compact UIs
 * - md: Default size
 */

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "info";
type BadgeSize = "sm" | "md";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Visual style variant
   * @default "default"
   */
  variant?: BadgeVariant;
  /**
   * Size variant
   * @default "md"
   */
  size?: BadgeSize;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const variantClasses: Record<BadgeVariant, string> = {
      default: "bg-surface-muted text-foreground-secondary border-transparent",
      primary: "bg-primary-subtle text-primary border-primary-subtle",
      success: "bg-success-subtle text-success border-success-subtle",
      warning: "bg-warning-subtle text-warning border-warning-subtle",
      error: "bg-error-subtle text-error border-error-subtle",
      info: "bg-info-subtle text-info border-info-subtle",
    };

    const sizeClasses: Record<BadgeSize, string> = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-2.5 py-0.5 text-sm",
    };

    return (
      <span
        ref={ref}
        role="status"
        aria-label={`${variant} badge`}
        className={cn(
          "inline-flex items-center justify-center rounded-badge border font-medium",
          "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
export type { BadgeProps, BadgeVariant, BadgeSize };
