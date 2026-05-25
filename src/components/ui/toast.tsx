"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { t } from "@/lib/translations";

/**
 * Toast Component
 *
 * A notification system for displaying temporary messages to users.
 * Supports multiple toast stacking, auto-dismiss, and accessibility features.
 *
 * Features:
 * - Multiple toast support with stacking
 * - Auto-dismiss with configurable duration
 * - Manual dismiss via close button
 * - Different variants (success, error, warning, info)
 * - Portal rendering at viewport edge
 * - Accessible (role="alert", aria-live="polite")
 * - Reduced motion support
 *
 * @example
 * ```tsx
 * // Basic usage with ToastProvider
 * <ToastProvider>
 *   <YourApp />
 * </ToastProvider>
 *
 * // Trigger toast from component
 * const { toast } = useToast();
 *
 * toast({
 *   title: "Success!",
 *   description: "Your changes have been saved.",
 *   variant: "success",
 * });
 *
 * // Different variants
 * toast({ title: "Error!", variant: "error" });
 * toast({ title: "Warning!", variant: "warning" });
 * toast({ title: "Info", variant: "info" });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastOptions {
  /**
   * Toast title (required)
   */
  title: string;
  /**
   * Optional description text
   */
  description?: string;
  /**
   * Visual style variant
   * @default "info"
   */
  variant?: ToastVariant;
  /**
   * Auto-dismiss duration in milliseconds
   * @default 5000
   */
  duration?: number;
  /**
   * Callback when toast is dismissed
   */
  onClose?: () => void;
}

interface ToastItem extends ToastOptions {
  id: string;
  createdAt: number;
}

// ============================================================================
// Context
// ============================================================================

interface ToastContextValue {
  /**
   * Trigger a new toast notification
   */
  toast: (options: ToastOptions) => void;
  /**
   * Dismiss a specific toast by ID
   */
  dismiss: (id: string) => void;
  /**
   * Dismiss all toasts
   */
  dismissAll: () => void;
  /**
   * Current active toasts
   */
  toasts: ToastItem[];
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/**
 * Hook to access the toast context
 * Must be used within a ToastProvider
 */
function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ============================================================================
// Icons
// ============================================================================

const ToastIcons: Record<ToastVariant, React.ReactNode> = {
  success: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ============================================================================
// Toast Item Component
// ============================================================================

interface ToastProps extends ToastOptions {
  /**
   * Unique toast ID
   */
  id: string;
  /**
   * Callback when toast should be dismissed
   */
  onDismiss: (id: string) => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      id,
      title,
      description,
      variant = "info",
      duration = 5000,
      onClose,
      onDismiss,
    },
    ref
  ) => {
    const [isExiting, setIsExiting] = React.useState(false);
    const [progress, setProgress] = React.useState(100);
    const progressIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const dismissTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Variant-specific styles using semantic tokens
    const variantClasses: Record<ToastVariant, string> = {
      success: "bg-success-subtle border-success text-success",
      error: "bg-error-subtle border-error text-error",
      warning: "bg-warning-subtle border-warning text-warning",
      info: "bg-info-subtle border-info text-info",
    };

    // Handle dismiss with exit animation
    const handleDismiss = React.useCallback(() => {
      setIsExiting(true);
      // Wait for exit animation before actually removing
      setTimeout(() => {
        onDismiss(id);
        onClose?.();
      }, 300);
    }, [id, onDismiss, onClose]);

    // Auto-dismiss logic with progress bar
    React.useEffect(() => {
      const updateInterval = 50; // Update progress every 50ms
      const decrementAmount = (100 * updateInterval) / duration;

      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          const next = prev - decrementAmount;
          return next < 0 ? 0 : next;
        });
      }, updateInterval);

      dismissTimeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        if (dismissTimeoutRef.current) {
          clearTimeout(dismissTimeoutRef.current);
        }
      };
    }, [duration, handleDismiss]);

    // Pause on hover
    const handleMouseEnter = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };

    const handleMouseLeave = () => {
      // Resume with remaining progress
      const remainingDuration = (progress / 100) * duration;
      
      const updateInterval = 50;
      const decrementAmount = (100 * updateInterval) / duration;

      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          const next = prev - decrementAmount;
          return next < 0 ? 0 : next;
        });
      }, updateInterval);

      dismissTimeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, remainingDuration);
    };

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        data-variant={variant}
        data-state={isExiting ? "exiting" : "entering"}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          // Base layout
          "relative flex items-start gap-3",
          "w-full max-w-sm",
          "p-comfortable",
          "rounded-card",
          "border",
          "shadow-lg",
          "overflow-hidden",
          // Variant styling
          variantClasses[variant],
          // Animation classes
          "transition-all duration-fast ease-out",
          isExiting
            ? "opacity-0 translate-x-full scale-95"
            : "opacity-100 translate-x-0 scale-100",
          // Entry animation
          "animate-in slide-in-from-right-full duration-fast ease-out"
        )}
      >
        {/* Icon */}
        <div className="shrink-0 mt-0.5" aria-hidden="true">
          {ToastIcons[variant]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-semibold leading-tight">{title}</h3>
          {description && (
            <p className="text-body-sm text-foreground-secondary mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            "shrink-0 -mr-1 -mt-1 p-1",
            "rounded-control-sm",
            "text-foreground-muted hover:text-foreground",
            "hover:bg-surface-muted",
            "transition-colors duration-fast",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          )}
          aria-label={t.components.toast.dismissNotification}
        >
          <CloseIcon />
        </button>

        {/* Progress bar */}
        <div
          className="absolute bottom-0 left-0 h-1 bg-current opacity-30"
          style={{
            width: `${progress}%`,
            transition: "width 50ms linear",
          }}
          aria-hidden="true"
        />
      </div>
    );
  }
);

Toast.displayName = "Toast";

// ============================================================================
// Toast Provider
// ============================================================================

interface ToastProviderProps {
  /**
   * Child components that can trigger toasts
   */
  children: React.ReactNode;
  /**
   * Maximum number of toasts to show at once
   * @default 5
   */
  maxToasts?: number;
  /**
   * Position of the toast container
   * @default "bottom-right"
   */
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
}

/**
 * ToastProvider - Context provider for toast notifications
 *
 * Wrap your application with this provider to enable toast notifications
 * throughout your component tree.
 */
function ToastProvider({
  children,
  maxToasts = 5,
  position = "bottom-right",
}: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  // Handle hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Generate unique ID
  const generateId = () => {
    return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  };

  // Add a new toast
  const toast = React.useCallback((options: ToastOptions) => {
    const id = generateId();
    const newToast: ToastItem = {
      ...options,
      id,
      createdAt: Date.now(),
    };

    setToasts((prev) => {
      // Add new toast at the beginning, limit to maxToasts
      const updated = [newToast, ...prev].slice(0, maxToasts);
      return updated;
    });
  }, [maxToasts]);

  // Dismiss a specific toast
  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Dismiss all toasts
  const dismissAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  // Position classes for the container
  const positionClasses = {
    "top-left": "top-0 left-0 items-start",
    "top-center": "top-0 left-1/2 -translate-x-1/2 items-center",
    "top-right": "top-0 right-0 items-end",
    "bottom-left": "bottom-0 left-0 items-start",
    "bottom-center": "bottom-0 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-0 right-0 items-end",
  };

  const contextValue = React.useMemo(
    () => ({
      toast,
      dismiss,
      dismissAll,
      toasts,
    }),
    [toast, dismiss, dismissAll, toasts]
  );

  // Toast container with portal rendering
  const toastContainer = (
    <div
      role="region"
      aria-label={t.components.toast.notificationsRegion}
      className={cn(
        "fixed z-[100]",
        "flex flex-col gap-3",
        "p-4",
        "pointer-events-none",
        positionClasses[position]
      )}
    >
      {toasts.map((toastItem) => (
        <div key={toastItem.id} className="pointer-events-auto">
          <Toast
            id={toastItem.id}
            title={toastItem.title}
            description={toastItem.description}
            variant={toastItem.variant}
            duration={toastItem.duration}
            onClose={toastItem.onClose}
            onDismiss={dismiss}
          />
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {mounted && typeof document !== "undefined" &&
        createPortal(toastContainer, document.body)}
    </ToastContext.Provider>
  );
}

// ============================================================================
// Exports
// ============================================================================

export {
  Toast,
  ToastProvider,
  useToast,
};

export type {
  ToastProps,
  ToastOptions,
  ToastVariant,
  ToastItem,
  ToastContextValue,
  ToastProviderProps,
};
