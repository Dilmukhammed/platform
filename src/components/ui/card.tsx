import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card Component
 * 
 * A container component for grouping related content.
 * Uses semantic tokens for consistent styling across the application.
 * 
 * Features:
 * - Surface raised background with border
 * - Configurable elevation (shadow)
 * - Sub-components for structured content layout
 * - Consistent padding and spacing
 */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Elevation level - adds shadow for depth
   * @default "none"
   */
  elevation?: "none" | "sm" | "md";
  /**
   * Whether the card is interactive (clickable/focusable)
   * Adds focus ring styles and keyboard support when true
   * @default false
   */
  interactive?: boolean;
  /**
   * Accessible label for interactive cards
   * Required for accessibility when card is interactive
   */
  "aria-label"?: string;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation = "none", interactive = false, onClick, onKeyDown, ...props }, ref) => {
    const isInteractive = interactive && (!!onClick || !!onKeyDown);

    const elevationClasses = {
      none: "",
      sm: "shadow-sm",
      md: "shadow-md",
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isInteractive) {
        onKeyDown?.(event);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
      }

      onKeyDown?.(event);
    };

    return (
      <div
        ref={ref}
        tabIndex={isInteractive ? 0 : undefined}
        role={isInteractive ? "button" : undefined}
        {...(isInteractive && onClick ? { onClick } : {})}
        {...(isInteractive ? { onKeyDown: handleKeyDown } : {})}
        className={cn(
          "bg-surface-raised rounded-card border border-border",
          "p-comfortable",
          elevationClasses[elevation],
          // Focus styles for interactive cards
          isInteractive && [
            "cursor-pointer",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-border-focus",
            "focus-visible:ring-offset-2",
            "focus-visible:ring-offset-surface",
          ],
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

/**
 * CardHeader
 * 
 * Container for card header content (title, description, actions).
 * Provides consistent spacing and layout for header elements.
 */
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 pb-4",
        className
      )}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

/**
 * CardTitle
 * 
 * Primary heading for the card.
 * Uses heading typography scale.
 */
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-h3 font-semibold leading-none tracking-tight",
        "text-foreground",
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

/**
 * CardDescription
 * 
 * Secondary text providing additional context.
 * Uses muted text color for visual hierarchy.
 */
interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-body-sm text-foreground-secondary",
        className
      )}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

/**
 * CardContent
 * 
 * Main content area of the card.
 * Provides consistent padding and layout.
 */
interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "pt-0",
        className
      )}
      {...props}
    />
  )
);
CardContent.displayName = "CardContent";

/**
 * CardFooter
 * 
 * Container for card actions or additional information.
 * Positioned at the bottom with consistent spacing.
 */
interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center pt-4",
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
};
