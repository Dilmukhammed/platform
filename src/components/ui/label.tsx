import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Label Component
 *
 * A form label component with consistent styling.
 * Uses semantic tokens only - no hardcoded values.
 *
 * Style: text-body-sm, text-foreground-secondary, font-medium
 */

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Whether the associated field is required */
  required?: boolean;
  /** Whether the label should be visually hidden (for accessibility) */
  visuallyHidden?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  (
    { className, children, required, visuallyHidden, ...props },
    ref
  ) => {
    return (
      <label
        ref={ref}
        className={cn(
          // Base styles
          "text-body-sm font-medium text-foreground-secondary",
          "transition-colors duration-fast ease-default",

          // Visually hidden variant (accessible but hidden visually)
          visuallyHidden && [
            "sr-only",
          ],

          className
        )}
        {...props}
      >
        {children}
        {required && (
          <span className="ml-0.5 text-error" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  }
);

Label.displayName = "Label";

export { Label };
