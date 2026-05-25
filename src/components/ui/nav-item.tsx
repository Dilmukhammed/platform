import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NavItem Component
 * 
 * Navigation item with role-accent active state indicator.
 * Follows the role-accent policy strictly.
 * 
 * Policy Compliance:
 * - ALLOWED: Role accent on active indicator (left border)
 * - FORBIDDEN: Role accent on text, background, or arbitrary recoloring
 * 
 * Design:
 * - Active state: Role-colored left border indicator (2px)
 * - Inactive state: Neutral colors, no role accent
 * - Text color remains neutral in both states (no role text colors)
 * - Background remains neutral in both states (no role backgrounds)
 * 
 * The role accent is ONLY on the active indicator - a subtle 2px left border
 * that provides contextual cue without overwhelming the interface.
 * 
 * @example
 * ```tsx
 * // Active student nav item
 * <NavItem role="student" active icon={<HomeIcon>}>
 *   Dashboard
 * </NavItem>
 * 
 * // Inactive nav item (no role accent)
 * <NavItem icon={<SettingsIcon>}>
 *   Settings
 * </NavItem>
 * 
 * // As a link
 * <NavItem asChild active role="teacher">
 *   <Link href="/teacher/classes">Classes</Link>
 * </NavItem>
 * ```
 */

type UserRole = "student" | "teacher" | "admin";

interface NavItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * User role for active state accent color
   * Only applies when active=true
   */
  role?: UserRole;
  /**
   * Whether this nav item is currently active
   * @default false
   */
  active?: boolean;
  /**
   * Icon element to display before text
   */
  icon?: React.ReactNode;
  /**
   * When true, renders children as the root element (polymorphic)
   * Useful for wrapping with Next.js Link or router Link
   */
  asChild?: boolean;
}

const roleIndicatorClasses: Record<UserRole, string> = {
  student: "border-l-role-student",
  teacher: "border-l-role-teacher",
  admin: "border-l-role-admin",
};

const NavItem = React.forwardRef<HTMLDivElement, NavItemProps>(
  ({ className, role, active = false, icon, asChild = false, children, ...props }, ref) => {
    // Base classes for all nav items
    const baseClasses = cn(
      "relative flex items-center gap-3 px-4 py-3",
      "text-foreground-secondary font-medium text-body",
      "transition-colors duration-fast ease-default",
      "hover:text-foreground hover:bg-surface-muted",
      "cursor-pointer select-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
    );

    // Active state classes - role accent ONLY on left border indicator
    const activeClasses = active
      ? cn(
          "text-foreground font-semibold",
          "bg-primary/10",
          "border-l-2",
          role ? roleIndicatorClasses[role] : "border-l-primary"
        )
      : "text-foreground-secondary font-medium border-l-2 border-l-transparent";

    const navItemClasses = cn(baseClasses, activeClasses, className);

    // Polymorphic rendering
    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        className?: string;
        [key: string]: unknown;
      }>;
      const childProps = child.props || {};

      return React.cloneElement(child, {
        ...props,
        ...childProps,
        className: cn(navItemClasses, childProps.className),
        ref,
        tabIndex: 0,
        "data-active": active,
        "data-role": role,
        "aria-current": active ? "page" : undefined,
      });
    }

    return (
      <div
        ref={ref}
        tabIndex={0}
        className={navItemClasses}
        data-active={active}
        data-role={role}
        aria-current={active ? "page" : undefined}
        {...props}
      >
        {icon && (
          <span className="inline-flex items-center justify-center shrink-0 w-5 h-5" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </div>
    );
  }
);
NavItem.displayName = "NavItem";

export { NavItem };
export type { NavItemProps, UserRole };
