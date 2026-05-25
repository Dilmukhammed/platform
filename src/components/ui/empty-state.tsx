import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState Component
 * 
 * Displayed when a table or data view has no content.
 * Provides a consistent, centered layout with:
 * - Icon placeholder area
 * - Title
 * - Description (uses text-foreground-secondary)
 * - Optional action button area
 * 
 * Uses semantic tokens for consistent styling.
 */

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Main title text
   */
  title?: string;
  /**
   * Description text (uses text-foreground-secondary)
   */
  description?: string;
  /**
   * Icon element to display
   */
  icon?: React.ReactNode;
  /**
   * Action element (button, link, etc.)
   */
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    { className, title, description, icon, action, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center",
          "px-4 py-12 text-center",
          className
        )}
        {...props}
      >
        {/* Icon Container */}
        {icon && (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-foreground-secondary">
            {icon}
          </div>
        )}

        {/* Title */}
        {title && (
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            {title}
          </h3>
        )}

        {/* Description */}
        {description && (
          <p className="mb-4 max-w-sm text-body text-foreground-secondary">
            {description}
          </p>
        )}

        {/* Custom children content */}
        {children}

        {/* Action */}
        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

/**
 * EmptyStateIcon
 * 
 * Pre-styled container for empty state icons.
 */
interface EmptyStateIconProps extends React.HTMLAttributes<HTMLDivElement> {}

const EmptyStateIcon = React.forwardRef<HTMLDivElement, EmptyStateIconProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mb-4 flex h-12 w-12 items-center justify-center",
        "rounded-full bg-surface-muted text-foreground-secondary",
        className
      )}
      {...props}
    />
  )
);
EmptyStateIcon.displayName = "EmptyStateIcon";

/**
 * EmptyStateTitle
 * 
 * Pre-styled title for empty states.
 */
interface EmptyStateTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const EmptyStateTitle = React.forwardRef<HTMLHeadingElement, EmptyStateTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "mb-2 text-lg font-semibold text-foreground",
        className
      )}
      {...props}
    />
  )
);
EmptyStateTitle.displayName = "EmptyStateTitle";

/**
 * EmptyStateDescription
 * 
 * Pre-styled description using text-foreground-secondary.
 */
interface EmptyStateDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const EmptyStateDescription = React.forwardRef<HTMLParagraphElement, EmptyStateDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "mb-4 max-w-sm text-body text-foreground-secondary",
        className
      )}
      {...props}
    />
  )
);
EmptyStateDescription.displayName = "EmptyStateDescription";

/**
 * EmptyStateAction
 * 
 * Container for empty state action buttons.
 */
interface EmptyStateActionProps extends React.HTMLAttributes<HTMLDivElement> {}

const EmptyStateAction = React.forwardRef<HTMLDivElement, EmptyStateActionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mt-2", className)}
      {...props}
    />
  )
);
EmptyStateAction.displayName = "EmptyStateAction";

export {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateAction,
};
export type {
  EmptyStateProps,
  EmptyStateIconProps,
  EmptyStateTitleProps,
  EmptyStateDescriptionProps,
  EmptyStateActionProps,
};
