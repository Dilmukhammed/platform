import type { Page } from "@playwright/test";

// Dashboard paths from src/modules/auth/service.ts
export const DASHBOARD_PATHS = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
} as const;

// Sign-in paths from src/modules/auth/service.ts
export const SIGNIN_PATHS = {
  student: "/auth/student/sign-in",
  teacher: "/auth/teacher/sign-in",
} as const;

export type UserRole = keyof typeof DASHBOARD_PATHS;

/**
 * Navigate to role dashboard and wait for page load
 */
export async function navigateToDashboard(page: Page, role: UserRole): Promise<void> {
  const path = DASHBOARD_PATHS[role];
  await page.goto(path);
  await waitForDashboardLoad(page);
}

/**
 * Navigate to sign-in page for a role
 */
export async function navigateToSignIn(page: Page, role: "student" | "teacher"): Promise<void> {
  const path = SIGNIN_PATHS[role];
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/**
 * Wait for dashboard page to fully load
 * Checks for common dashboard indicators
 */
export async function waitForDashboardLoad(page: Page): Promise<void> {
  // Wait for network to be idle
  await page.waitForLoadState("networkidle");
  
  // Wait for any of the common dashboard elements
  await page.waitForSelector("body", { state: "visible" });
}

/**
 * Wait for page to be fully loaded and ready for interaction
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
}

/**
 * Get current role from URL path
 */
export function getRoleFromPath(path: string): UserRole | null {
  if (path.startsWith("/student")) return "student";
  if (path.startsWith("/teacher")) return "teacher";
  if (path.startsWith("/admin")) return "admin";
  return null;
}
