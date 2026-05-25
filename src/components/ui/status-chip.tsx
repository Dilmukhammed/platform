import * as React from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/translations";

/**
 * StatusChip Component
 * 
 * Status indicator component with optional dot.
 * Maps to semantic status colors: success, warning, error, info.
 * 
 * Uses the bg-{status}-subtle + text-{status} pattern for consistent
 * semantic color usage across the application.
 * 
 * Features:
 * - Optional dot indicator
 * - Semantic color mapping
 * - Consistent with design system tokens
 */

type StatusType = "success" | "warning" | "error" | "info";
type StatusSize = "sm" | "md";

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Status type determining color scheme
   * @default "info"
   */
  status?: StatusType;
  /**
   * Whether to show a dot indicator
   * @default true
   */
  showDot?: boolean;
  /**
   * Size variant
   * @default "md"
   */
  size?: StatusSize;
  /**
   * Custom label text (defaults to capitalized status)
   */
  label?: string;
}

const statusLabels: Record<StatusType, string> = {
  success: t.components.statusChip.success,
  warning: t.components.statusChip.warning,
  error: t.components.statusChip.error,
  info: t.components.statusChip.info,
};

const StatusChip = React.forwardRef<HTMLSpanElement, StatusChipProps>(
  (
    {
      className,
      status = "info",
      showDot = true,
      size = "md",
      label,
      children,
      ...props
    },
    ref
  ) => {
    const statusClasses: Record<StatusType, { bg: string; text: string; dot: string }> = {
      success: {
        bg: "bg-success-subtle",
        text: "text-success",
        dot: "bg-success",
      },
      warning: {
        bg: "bg-warning-subtle",
        text: "text-warning",
        dot: "bg-warning",
      },
      error: {
        bg: "bg-error-subtle",
        text: "text-error",
        dot: "bg-error",
      },
      info: {
        bg: "bg-info-subtle",
        text: "text-info",
        dot: "bg-info",
      },
    };

    const sizeClasses: Record<StatusSize, { container: string; dot: string }> = {
      sm: {
        container: "px-2 py-0.5 text-xs gap-1.5",
        dot: "w-1.5 h-1.5",
      },
      md: {
        container: "px-2.5 py-1 text-sm gap-2",
        dot: "w-2 h-2",
      },
    };

    const styles = statusClasses[status];
    const sizeStyles = sizeClasses[size];

    const displayLabel = children || label || statusLabels[status];

    return (
      <span
        ref={ref}
        role="status"
        aria-label={`${displayLabel} status`}
        className={cn(
          "inline-flex items-center rounded-badge font-medium",
          styles.bg,
          styles.text,
          sizeStyles.container,
          className
        )}
        {...props}
      >
        {showDot && (
          <span
            className={cn(
              "rounded-full",
              styles.dot,
              sizeStyles.dot
            )}
          />
        )}
        <span>{displayLabel}</span>
      </span>
    );
  }
);
StatusChip.displayName = "StatusChip";

export { StatusChip };
export type { StatusChipProps, StatusType, StatusSize };
