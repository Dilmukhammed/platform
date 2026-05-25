"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Modal Component
 *
 * An accessible modal dialog component with focus trap, keyboard navigation,
 * and portal rendering. Follows WAI-ARIA dialog patterns for accessibility.
 *
 * Features:
 * - Focus trap (focus stays within modal when open)
 * - Escape key to close
 * - Click outside (overlay) to close
 * - Portal rendering (renders at document body)
 * - Proper ARIA attributes (role="dialog", aria-modal="true")
 * - aria-labelledby pointing to title
 * - aria-describedby pointing to description (optional)
 * - Reduced motion support
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Modal open={isOpen} onOpenChange={setIsOpen} title="Confirm Action">
 *   <p>Are you sure you want to proceed?</p>
 *   <ModalFooter>
 *     <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
 *     <Button onClick={handleConfirm}>Confirm</Button>
 *   </ModalFooter>
 * </Modal>
 *
 * // With description
 * <Modal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Delete Item"
 *   description="This action cannot be undone."
 * >
 *   <ModalFooter>
 *     <Button variant="destructive" onClick={handleDelete}>Delete</Button>
 *   </ModalFooter>
 * </Modal>
 *
 * // Compound component pattern
 * <Modal open={isOpen} onOpenChange={setIsOpen}>
 *   <ModalContent>
 *     <ModalHeader>
 *       <ModalTitle>Custom Title</ModalTitle>
 *       <ModalDescription>Custom description</ModalDescription>
 *     </ModalHeader>
 *     <div>Custom content</div>
 *     <ModalFooter>
 *       <ModalClose asChild>
 *         <Button variant="ghost">Close</Button>
 *       </ModalClose>
 *     </ModalFooter>
 *   </ModalContent>
 * </Modal>
 * ```
 */

// ============================================================================
// Context
// ============================================================================

interface ModalContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const ModalContext = React.createContext<ModalContextValue | null>(null);

function useModalContext() {
  const context = React.useContext(ModalContext);
  if (!context) {
    throw new Error("Modal components must be used within a Modal");
  }
  return context;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to trap focus within the modal when open
 */
function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean
) {
  React.useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    // Find all focusable elements
    const getFocusableElements = () => {
      const selector = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable]',
      ].join(', ');

      return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null // Only visible elements
      );
    };

    // Store the element that had focus before opening
    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Focus the first focusable element or the container itself
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      const activeElement = document.activeElement;

      // Shift + Tab: moving backwards
      if (event.shiftKey) {
        if (activeElement === firstElement || !container.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forwards
        if (activeElement === lastElement || !container.contains(activeElement)) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus when modal closes
      previousActiveElement?.focus();
    };
  }, [enabled, containerRef]);
}

/**
 * Hook to handle escape key press
 */
function useEscapeKey(handler: () => void, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handler]);
}

/**
 * Hook to lock body scroll when modal is open
 */
function useBodyScrollLock(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [enabled]);
}

/**
 * Hook to generate unique IDs for accessibility
 */
function useId(prefix: string): string {
  const [id] = React.useState(() => `${prefix}-${Math.random().toString(36).slice(2, 11)}`);
  return id;
}

// ============================================================================
// Components
// ============================================================================

interface ModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;
  /**
   * Callback when the open state changes
   */
  onOpenChange: (open: boolean) => void;
  /**
   * Modal title (required for accessibility)
   */
  title?: string;
  /**
   * Optional modal description
   */
  description?: string;
  /**
   * Modal content (when using compound components, don't use title/description props)
   */
  children?: React.ReactNode;
}

/**
 * Modal - Root component for the modal dialog
 */
function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: ModalProps) {
  const titleId = useId('modal-title');
  const descriptionId = useId('modal-description');

  const contextValue = React.useMemo(
    () => ({
      open,
      onOpenChange,
      titleId,
      descriptionId,
    }),
    [open, onOpenChange, titleId, descriptionId]
  );

  // Handle escape key
  useEscapeKey(() => onOpenChange(false), open);

  // Lock body scroll
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <ModalContext.Provider value={contextValue}>
      {title !== undefined || description !== undefined ? (
        <ModalContent>
          {(title || description) && (
            <ModalHeader>
              {title && <ModalTitle>{title}</ModalTitle>}
              {description && <ModalDescription>{description}</ModalDescription>}
            </ModalHeader>
          )}
          {children}
        </ModalContent>
      ) : (
        children
      )}
    </ModalContext.Provider>
  );
}

// ============================================================================
// Modal Trigger
// ============================================================================

interface ModalTriggerProps {
  /**
   * The element that triggers the modal
   */
  children: React.ReactElement;
  /**
   * Callback when the trigger is clicked
   */
  onClick?: () => void;
}

/**
 * ModalTrigger - Component to trigger modal opening
 *
 * Wraps a child element and adds click handler to open the modal.
 * The child element should be an interactive element (button, link, etc.).
 */
function ModalTrigger({ children, onClick }: ModalTriggerProps) {
  const context = useModalContext();

  const handleClick = () => {
    onClick?.();
    context.onOpenChange(true);
  };

  const child = React.Children.only(children) as React.ReactElement<{
    onClick?: () => void;
  }>;

  return React.cloneElement(child, {
    onClick: handleClick,
  });
}

// ============================================================================
// Modal Content
// ============================================================================

interface ModalContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Modal content
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ModalContent - Container for modal content with overlay
 *
 * Renders the modal in a portal at document body level.
 * Handles click outside to close and focus trap.
 */
const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ children, className, ...props }, forwardedRef) => {
    const context = useModalContext();
    const contentRef = React.useRef<HTMLDivElement>(null);

    // Merge refs
    React.useImperativeHandle(
      forwardedRef,
      () => contentRef.current as HTMLDivElement
    );

    // Focus trap
    useFocusTrap(contentRef, context.open);

    // Handle overlay click
    const handleOverlayClick = (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        context.onOpenChange(false);
      }
    };

    const modalContent = (
      <div
        role="presentation"
        className={cn(
          // Fixed overlay covering entire viewport
          "fixed inset-0 z-50",
          // Flex centering
          "flex items-center justify-center",
          // Backdrop styling
          "bg-surface/80 backdrop-blur-sm",
          // Animation
          "animate-in fade-in duration-fast ease-out"
        )}
        onClick={handleOverlayClick}
        data-state={context.open ? 'open' : 'closed'}
      >
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={context.titleId}
          aria-describedby={context.descriptionId}
          tabIndex={-1}
          className={cn(
            // Base layout
            "relative z-50",
            "w-full max-w-lg",
            "mx-4",
            // Visual styling
            "bg-surface-raised",
            "rounded-card",
            "border border-border",
            "shadow-lg",
            // Spacing
            "p-comfortable",
            // Focus
            "focus:outline-none",
            // Animation
            "animate-in zoom-in-95 slide-in-from-bottom-4 duration-fast ease-out",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );

    // Portal rendering
    if (typeof document !== 'undefined') {
      return createPortal(modalContent, document.body);
    }

    return null;
  }
);
ModalContent.displayName = 'ModalContent';

// ============================================================================
// Modal Header
// ============================================================================

interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Header content (typically ModalTitle and ModalDescription)
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ModalHeader - Container for modal title and description
 */
const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2",
        "pb-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
ModalHeader.displayName = 'ModalHeader';

// ============================================================================
// Modal Title
// ============================================================================

interface ModalTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Title text
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ModalTitle - Accessible title for the modal
 *
 * Automatically linked to the dialog via aria-labelledby.
 */
const ModalTitle = React.forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ children, className, ...props }, ref) => {
    const context = useModalContext();

    return (
      <h2
        ref={ref}
        id={context.titleId}
        className={cn(
          "text-h3 font-semibold leading-none tracking-tight",
          "text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </h2>
    );
  }
);
ModalTitle.displayName = 'ModalTitle';

// ============================================================================
// Modal Description
// ============================================================================

interface ModalDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /**
   * Description text
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ModalDescription - Accessible description for the modal
 *
 * Automatically linked to the dialog via aria-describedby.
 */
const ModalDescription = React.forwardRef<HTMLParagraphElement, ModalDescriptionProps>(
  ({ children, className, ...props }, ref) => {
    const context = useModalContext();

    return (
      <p
        ref={ref}
        id={context.descriptionId}
        className={cn(
          "text-body-sm text-foreground-secondary",
          className
        )}
        {...props}
      >
        {children}
      </p>
    );
  }
);
ModalDescription.displayName = 'ModalDescription';

// ============================================================================
// Modal Footer
// ============================================================================

interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Footer content (typically action buttons)
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ModalFooter - Container for modal action buttons
 */
const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-3",
        "pt-4 mt-4",
        "border-t border-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
ModalFooter.displayName = 'ModalFooter';

// ============================================================================
// Modal Close
// ============================================================================

interface ModalCloseProps {
  /**
   * The element that closes the modal
   */
  children: React.ReactElement;
  /**
   * Callback when the close is triggered
   */
  onClick?: () => void;
  /**
   * When true, passes props to child element (polymorphic pattern)
   */
  asChild?: boolean;
}

/**
 * ModalClose - Component to close the modal
 *
 * Wraps a child element and adds click handler to close the modal.
 * Can be used with asChild for polymorphic rendering.
 */
function ModalClose({ children, onClick, asChild = false }: ModalCloseProps) {
  const context = useModalContext();

  const handleClick = () => {
    onClick?.();
    context.onOpenChange(false);
  };

  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<{
      onClick?: () => void;
    }>;

    return React.cloneElement(child, {
      onClick: handleClick,
    });
  }

  return (
    <button onClick={handleClick} type="button">
      {children}
    </button>
  );
}

// ============================================================================
// Exports
// ============================================================================

export {
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
};

export type {
  ModalProps,
  ModalTriggerProps,
  ModalContentProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalDescriptionProps,
  ModalFooterProps,
  ModalCloseProps,
};
