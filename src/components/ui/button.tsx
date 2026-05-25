"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button component with comprehensive variant, size, and state support.
 * 
 * Features:
 * - Variants: primary, secondary, ghost, destructive
 * - Sizes: sm, md, lg
 * - States: default, hover, focus, active, disabled, loading
 * - Polymorphic rendering via asChild prop (custom implementation)
 * - Full TypeScript support with ref forwarding
 * - Semantic token-based styling (no hardcoded values)
 * - Accessibility: focus rings, disabled states, aria attributes
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <Button>Click me</Button>
 * 
 * // With variant and size
 * <Button variant="destructive" size="lg">Delete</Button>
 * 
 * // Loading state
 * <Button loading>Saving...</Button>
 * 
 * // As a link
 * <Button asChild>
 *   <a href="/dashboard">Go to Dashboard</a>
 * </Button>
 * 
 * // With Next.js Link
 * <Button asChild>
 *   <Link href="/about">About</Link>
 * </Button>
 * ```
 */

/**
 * Loading spinner icon component
 * Inline SVG to avoid external dependency
 */
const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg
    className={cn("animate-spin", className)}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * Button variants using class-variance-authority
 * Maps to semantic Tailwind classes that reference CSS custom properties
 */
const buttonVariants = cva(
  // Base styles - reset + layout + transitions
  [
    // Reset
    "appearance-none border-0 bg-transparent cursor-pointer",
    
    // Layout
    "inline-flex items-center justify-center",
    "gap-[var(--control-gap-md)]",
    
    // Typography
    "font-sans font-medium leading-none no-underline whitespace-nowrap",
    
    // Transitions using motion tokens
    "transition-all duration-fast ease-default",
  ],
  {
    variants: {
      /**
       * Visual style variant
       * - primary: Filled with primary accent color, white text
       * - secondary: Outlined with border, primary text, transparent bg
       * - ghost: No border, no bg, primary text, subtle hover bg
       * - destructive: Filled with error color, white text
       */
      variant: {
        primary: [
          "bg-primary text-foreground-inverse",
          "hover:bg-primary-hover",
          "active:bg-primary-active",
        ],
        secondary: [
          "bg-transparent text-primary border border-border",
          "hover:bg-surface-muted hover:border-border-hover",
          "active:bg-surface",
        ],
        ghost: [
          "bg-transparent text-primary border-none",
          "hover:bg-primary-subtle",
          "active:bg-surface-muted",
        ],
        destructive: [
          "bg-error text-foreground-inverse",
          "hover:bg-error/90",
          "active:bg-error/80",
        ],
      },
      /**
       * Size variant affecting height, padding, font size, and radius
       * - sm: 32px height, 8px padding-x, 13px font, control-sm radius
       * - md: 40px height, 12px padding-x, 14px font, control-md radius
       * - lg: 48px height, 16px padding-x, 16px font, control-md radius
       */
      size: {
        sm: [
          "h-[var(--control-sm-height)]",
          "px-[var(--control-sm-padding-x)]",
          "text-[var(--control-sm-font)]",
          "rounded-control-sm",
        ],
        md: [
          "h-[var(--control-md-height)]",
          "px-[var(--control-md-padding-x)]",
          "text-[var(--control-md-font)]",
          "rounded-control-md",
        ],
        lg: [
          "h-[var(--control-lg-height)]",
          "px-[var(--control-lg-padding-x)]",
          "text-[var(--control-lg-font)]",
          "rounded-control-md",
        ],
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

/**
 * Props for the Button component
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, the button will render its child as the root element
   * (polymorphic pattern - passes props to single child)
   */
  asChild?: boolean;
  
  /**
   * When true, shows a loading spinner and disables interaction
   */
  loading?: boolean;
  
  /**
   * Icon to display before the button text
   */
  leftIcon?: React.ReactNode;
  
  /**
   * Icon to display after the button text
   */
  rightIcon?: React.ReactNode;
}

/**
 * Button component - Primary interactive control
 * 
 * @component
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      asChild = false,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    // Determine if the button is effectively disabled
    const isDisabled = disabled || loading;
    
    // Icon sizing based on button size
    const iconSizeClasses = {
      sm: "w-[var(--control-icon-sm)] h-[var(--control-icon-sm)]",
      md: "w-[var(--control-icon-md)] h-[var(--control-icon-md)]",
      lg: "w-[var(--control-icon-lg)] h-[var(--control-icon-lg)]",
    };
    
    // Compute the button classes
    const buttonClasses = cn(
      buttonVariants({ variant, size }),
      // Focus ring styles
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
      // Disabled/loading states
      isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
      // Active/pressed scale effect
      "active:scale-95",
      className
    );
    
    // Polymorphic rendering: when asChild is true, we clone the single child
    // and merge our button props/classes with it
    if (asChild) {
      // Validate that we have exactly one child element
      const child = React.Children.only(children) as React.ReactElement<{
        className?: string;
        [key: string]: unknown;
      }>;
      
      const childProps = child.props || {};
      
      return React.cloneElement(child, {
        ...props,
        ...childProps,
        className: cn(buttonClasses, childProps.className),
        ref,
        disabled: isDisabled,
        "data-variant": variant,
        "data-size": size,
        "data-loading": loading,
        "data-disabled": isDisabled,
        "aria-busy": loading,
        "aria-disabled": isDisabled,
      });
    }
    
    // Standard button rendering
    return (
      <button
        type="button"
        className={buttonClasses}
        ref={ref}
        disabled={isDisabled}
        // Data attributes for styling hooks and state tracking
        data-variant={variant}
        data-size={size}
        data-loading={loading}
        data-disabled={isDisabled}
        // Accessibility attributes
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {/* Loading spinner - shown when loading */}
        {loading && (
          <LoadingSpinner 
            className={cn(
              "shrink-0",
              iconSizeClasses[size as keyof typeof iconSizeClasses]
            )} 
          />
        )}
        
        {/* Left icon (not shown during loading to prevent layout shift) */}
        {!loading && leftIcon && (
          <span 
            className={cn(
              "shrink-0 inline-flex items-center justify-center",
              iconSizeClasses[size as keyof typeof iconSizeClasses]
            )}
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}
        
        {/* Button content */}
        <span className={cn(loading && "invisible")}>{children}</span>
        
        {/* Right icon (not shown during loading) */}
        {!loading && rightIcon && (
          <span 
            className={cn(
              "shrink-0 inline-flex items-center justify-center",
              iconSizeClasses[size as keyof typeof iconSizeClasses]
            )}
            aria-hidden="true"
          >
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
