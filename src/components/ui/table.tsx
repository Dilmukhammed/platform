import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Table Component
 * 
 * A comprehensive table component with support for:
 * - Row hover states
 * - Row selection states
 * - Striped rows
 * - Density variants (default, compact)
 * - Empty state handling
 * 
 * Uses semantic tokens for consistent styling.
 */

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-sm",
          className
        )}
        {...props}
      />
    </div>
  )
);
Table.displayName = "Table";

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        "border-b border-border",
        className
      )}
      {...props}
    />
  )
);
TableHeader.displayName = "TableHeader";

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn(
        "[&_tr:last-child]:border-0",
        className
      )}
      {...props}
    />
  )
);
TableBody.displayName = "TableBody";

interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableFooter = React.forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn(
        "border-t border-border bg-surface-muted font-medium",
        className
      )}
      {...props}
    />
  )
);
TableFooter.displayName = "TableFooter";

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /**
   * Whether the row is selected
   * @default false
   */
  selected?: boolean;
  /**
   * Whether the row has hover state disabled
   * @default false
   */
  noHover?: boolean;
  /**
   * Whether the row is interactive (clickable/focusable)
   * Adds focus ring styles and keyboard support when true
   * @default false
   */
  interactive?: boolean;
  /**
   * Accessible label for the row when interactive
   * Describes what the row represents or what action it triggers
   */
  'aria-label'?: string;
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected = false, noHover = false, interactive = false, onClick, onKeyDown, ...props }, ref) => {
    const isInteractive = interactive && (!!onClick || !!onKeyDown);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (isInteractive && onClick) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent<HTMLTableRowElement>);
        }
      }
      onKeyDown?.(e);
    };

    return (
      <tr
        ref={ref}
        tabIndex={isInteractive ? 0 : undefined}
        role={isInteractive ? "button" : undefined}
        {...(isInteractive && onClick ? { onClick } : {})}
        {...(isInteractive ? { onKeyDown: handleKeyDown } : {})}
        className={cn(
          "border-b border-border transition-colors",
          !noHover && !selected && "hover:bg-surface-muted",
          selected && "bg-primary-subtle hover:bg-primary-subtle",
          // Focus styles for interactive rows
          isInteractive && [
            "cursor-pointer",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-border-focus",
            "focus-visible:ring-offset-1",
            "focus-visible:ring-offset-surface",
          ],
          className
        )}
        data-selected={selected}
        data-interactive={isInteractive}
        {...props}
      />
    );
  }
);
TableRow.displayName = "TableRow";

interface TableHeadProps extends React.HTMLAttributes<HTMLTableCellElement> {
  /**
   * Density variant affecting padding
   * @default "default"
   */
  density?: "default" | "compact";
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, density = "default", ...props }, ref) => {
    const densityClasses = {
      default: "h-12 px-4 py-3",
      compact: "h-8 px-2 py-1.5",
    };

    return (
      <th
        ref={ref}
        scope="col"
        className={cn(
          "text-left align-middle font-medium text-foreground-secondary",
          densityClasses[density],
          className
        )}
        {...props}
      />
    );
  }
);
TableHead.displayName = "TableHead";

interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  /**
   * Density variant affecting padding
   * @default "default"
   */
  density?: "default" | "compact";
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, density = "default", ...props }, ref) => {
    const densityClasses = {
      default: "p-4",
      compact: "px-2 py-1.5",
    };

    return (
      <td
        ref={ref}
        className={cn(
          "align-middle text-foreground",
          densityClasses[density],
          className
        )}
        {...props}
      />
    );
  }
);
TableCell.displayName = "TableCell";

interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}

const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn(
        "mt-4 text-sm text-foreground-secondary",
        className
      )}
      {...props}
    />
  )
);
TableCaption.displayName = "TableCaption";

/**
 * TableStriped
 * 
 * Wrapper component that enables striped row styling.
 * Apply to Table or wrap the Table component.
 */
interface TableStripedProps extends React.HTMLAttributes<HTMLDivElement> {}

const TableStriped = React.forwardRef<HTMLDivElement, TableStripedProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "[&_tbody_tr:nth-child(even)]:bg-surface",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
TableStriped.displayName = "TableStriped";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableStriped,
};
export type {
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableFooterProps,
  TableHeadProps,
  TableRowProps,
  TableCellProps,
  TableCaptionProps,
  TableStripedProps,
};
