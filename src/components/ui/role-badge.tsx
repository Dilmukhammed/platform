import * as React from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/translations";

/**
 * RoleBadge Component
 * 
 * Small, subtle role indicator for contextual cues.
 * Uses role accent tokens ONLY - following the role-accent policy.
 * 
 * Policy Compliance:
 * - ALLOWED: Small badges, context markers
 * - FORBIDDEN: Main body text color shifts, page background recoloring
 * 
 * Design:
 * - Small, subtle — not a large colored block
 * - Uses bg-{role}-subtle with text-{role} pattern
 * - Consistent sizing and styling across all roles
 * 
 * Roles:
 * - student: Blue accent for learners
 * - teacher: Violet accent for educators
 * - admin: Amber accent for administrators
 * 
 * @example
 * ```tsx
 * <RoleBadge role="student" />           // Shows "Student"
 * <RoleBadge role="teacher" size="sm" /> // Small teacher badge
 * <RoleBadge role="admin">Admin</RoleBadge> // Custom label
 * ```
 */

type UserRole = "student" | "teacher" | "admin";
type BadgeSize = "sm" | "md";

interface RoleBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * User role determining the accent color
   * @required
   */
  role: UserRole;
  /**
   * Size variant
   * @default "md"
   */
  size?: BadgeSize;
  /**
   * Custom label text (defaults to capitalized role name)
   */
  children?: React.ReactNode;
}

const roleLabels: Record<UserRole, string> = {
  student: t.student.layout.role,
  teacher: t.teacher.layout.role,
  admin: t.admin.layout.admin,
};

const roleClasses: Record<UserRole, string> = {
  student: "bg-role-student-subtle text-role-student border-role-student-border",
  teacher: "bg-role-teacher-subtle text-role-teacher border-role-teacher-border",
  admin: "bg-role-admin-subtle text-role-admin border-role-admin-border",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-sm",
};

const RoleBadge = React.forwardRef<HTMLSpanElement, RoleBadgeProps>(
  ({ className, role, size = "md", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-badge border font-medium",
          "transition-colors duration-fast ease-default",
          roleClasses[role],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children || roleLabels[role]}
      </span>
    );
  }
);
RoleBadge.displayName = "RoleBadge";

export { RoleBadge };
export type { RoleBadgeProps, UserRole, BadgeSize };
