"use client";

import * as React from "react";

/**
 * Motion Context
 *
 * Provides access to motion preferences throughout the application.
 * Tracks the user's prefers-reduced-motion setting and provides
 * duration values that respect this preference.
 *
 * Features:
 * - SSR-safe (defaults to false on server)
 * - Reactive to media query changes
 * - Provides adjusted duration values for reduced motion
 * - Essential animations (loading spinners) remain enabled
 */

interface MotionContextValue {
  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Duration values adjusted for motion preference */
  duration: {
    /** Fast duration (0ms if reduced motion, 120ms otherwise) */
    fast: number;
    /** Normal duration (0ms if reduced motion, 150ms otherwise) */
    normal: number;
    /** Slow duration (0ms if reduced motion, 180ms otherwise) */
    slow: number;
  };
  /** Easing values adjusted for motion preference */
  easing: {
    /** Default easing (linear if reduced motion) */
    default: string;
    /** Ease-in easing (linear if reduced motion) */
    in: string;
    /** Ease-out easing (linear if reduced motion) */
    out: string;
    /** Spring easing (linear if reduced motion) */
    spring: string;
  };
}

const MotionContext = React.createContext<MotionContextValue | undefined>(
  undefined
);

// Default duration values (normal motion)
const DEFAULT_DURATIONS = {
  fast: 120,
  normal: 150,
  slow: 180,
};

// Default easing values (normal motion)
const DEFAULT_EASINGS = {
  default: "cubic-bezier(0.4, 0, 0.2, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  out: "cubic-bezier(0, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

// Reduced motion values
const REDUCED_MOTION_DURATIONS = {
  fast: 0,
  normal: 0,
  slow: 0,
};

const REDUCED_MOTION_EASINGS = {
  default: "linear",
  in: "linear",
  out: "linear",
  spring: "linear",
};

interface MotionProviderProps {
  children: React.ReactNode;
}

/**
 * MotionProvider
 *
 * Wraps the application to provide motion preference context.
 * Automatically detects prefers-reduced-motion media query.
 *
 * @example
 * ```tsx
 * // In your root layout
 * <MotionProvider>
 *   <App />
 * </MotionProvider>
 *
 * // In a component
 * const { prefersReducedMotion, duration } = useMotion();
 *
 * // Use with CSS-in-JS or inline styles
 * <div style={{ transitionDuration: `${duration.fast}ms` }}>
 *   Content
 * </div>
 * ```
 */
function MotionProvider({ children }: MotionProviderProps) {
  // Default to false for SSR (server doesn't know user's preference)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes to the preference
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Add listener (using addEventListener for modern browsers)
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Compute values based on preference
  const duration = prefersReducedMotion
    ? REDUCED_MOTION_DURATIONS
    : DEFAULT_DURATIONS;

  const easing = prefersReducedMotion
    ? REDUCED_MOTION_EASINGS
    : DEFAULT_EASINGS;

  const value = React.useMemo(
    () => ({
      prefersReducedMotion,
      duration,
      easing,
    }),
    [prefersReducedMotion, duration, easing]
  );

  // During SSR, provide default values
  if (!isClient) {
    return (
      <MotionContext.Provider
        value={{
          prefersReducedMotion: false,
          duration: DEFAULT_DURATIONS,
          easing: DEFAULT_EASINGS,
        }}
      >
        {children}
      </MotionContext.Provider>
    );
  }

  return (
    <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
  );
}

/**
 * useMotion Hook
 *
 * Returns the current motion preference context.
 * Must be used within a MotionProvider.
 *
 * @returns MotionContextValue with prefersReducedMotion, duration, and easing
 * @throws Error if used outside of MotionProvider
 *
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const { prefersReducedMotion, duration, easing } = useMotion();
 *
 *   return (
 *     <motion.div
 *       animate={{
 *         // Use reduced motion-aware values
 *         transition: {
 *           duration: duration.fast / 1000, // convert to seconds
 *           ease: easing.default,
 *         }
 *       }}
 *     />
 *   );
 * }
 * ```
 */
function useMotion(): MotionContextValue {
  const context = React.useContext(MotionContext);

  if (context === undefined) {
    throw new Error("useMotion must be used within a MotionProvider");
  }

  return context;
}

/**
 * useReducedMotion Hook
 *
 * Convenience hook that only returns the prefersReducedMotion boolean.
 * Useful for conditional logic based on motion preference.
 *
 * @returns boolean indicating if reduced motion is preferred
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const prefersReducedMotion = useReducedMotion();
 *
 *   return (
 *     <div>
 *       {prefersReducedMotion ? (
 *         <StaticContent />
 *       ) : (
 *         <AnimatedContent />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
function useReducedMotion(): boolean {
  const { prefersReducedMotion } = useMotion();
  return prefersReducedMotion;
}

export {
  MotionProvider,
  useMotion,
  useReducedMotion,
  type MotionContextValue,
  type MotionProviderProps,
};
