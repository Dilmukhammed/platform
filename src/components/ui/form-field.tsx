import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/**
 * FormField Component
 *
 * A wrapper component that combines label, input, and error message
 * with proper spacing and accessibility.
 *
 * Uses semantic tokens only - no hardcoded values.
 */

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label text for the field */
  label?: string;
  /** HTML for attribute - associates label with input */
  htmlFor?: string;
  /** Error message to display */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Hint text displayed below the input */
  hint?: string;
  /** The input element (Input, Textarea, Select, etc.) */
  children: React.ReactNode;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      className,
      label,
      htmlFor,
      error,
      required,
      hint,
      children,
      ...props
    },
    ref
  ) => {
    // Generate unique ID if htmlFor is not provided
    const generatedId = React.useId();
    const fieldId = htmlFor || generatedId;

    // Clone the child element to inject id and aria attributes
    const enhancedChildren = React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, {
          id: fieldId,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error
            ? `${fieldId}-error`
            : hint
            ? `${fieldId}-hint`
            : undefined,
        } as React.Attributes & Record<string, unknown>);
      }
      return child;
    });

    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "flex flex-col gap-1.5",
          "w-full",

          className
        )}
        {...props}
      >
        {/* Label */}
        {label && (
          <Label htmlFor={fieldId} required={required}>
            {label}
          </Label>
        )}

        {/* Input element */}
        {enhancedChildren}

        {/* Hint text */}
        {hint && !error && (
          <p
            id={`${fieldId}-hint`}
            className="text-caption text-foreground-muted"
          >
            {hint}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p
            id={`${fieldId}-error`}
            className="text-caption text-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = "FormField";

export { FormField };
