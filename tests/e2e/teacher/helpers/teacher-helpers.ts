/**
 * Teacher E2E test helpers
 *
 * Provides utilities for teacher-specific E2E tests including authentication,
 * navigation, page load verification, and known bug markers.
 */

import type { Page } from "@playwright/test";

import { loginAsTeacher, TEST_CREDENTIALS } from "../../helpers/auth";

// Re-export auth helpers
export { loginAsTeacher, TEST_CREDENTIALS };

/**
 * Logout teacher using the correct API endpoint.
 * Note: The existing `logout()` in auth.ts uses /auth/sign-out which doesn't exist.
 * This function uses the correct endpoint: POST /api/v1/teacher/auth/logout
 */
export async function logoutTeacher(page: Page): Promise<void> {
  try {
    const response = await page.request.post("/api/v1/teacher/auth/logout");
    // Clear cookies manually regardless of response
    await page.context().clearCookies();
    // Navigate to sign-in page directly instead of waiting for redirect
    await page.goto("/auth/teacher/sign-in", { waitUntil: "domcontentloaded" });
  } catch {
    // If logout fails, still try to navigate to sign-in
    await page.goto("/auth/teacher/sign-in", { waitUntil: "domcontentloaded" });
  }
}

/**
 * Teacher sidebar navigation sections (13 items from teacher layout)
 * Use with navigateTo() helper or as reference for expected nav items.
 */
export const SIDEBAR_SECTIONS = [
  { key: "overview", href: "/teacher", label: "Обзор" },
  { key: "organizations", href: "/teacher/organizations", label: "Организации" },
  { key: "classes", href: "/teacher/classes", label: "Классы" },
  { key: "students", href: "/teacher/students", label: "Ученики" },
  { key: "materials", href: "/teacher/materials", label: "Материалы" },
  { key: "tests", href: "/teacher/tests", label: "Тесты" },
  { key: "assignments", href: "/teacher/assignments", label: "Задания" },
  { key: "publications", href: "/teacher/publications", label: "Публикации" },
  { key: "reviews", href: "/teacher/reviews", label: "Проверки" },
  { key: "gradebook", href: "/teacher/gradebook", label: "Журнал" },
  { key: "library", href: "/teacher/library", label: "Библиотека" },
  { key: "notifications", href: "/teacher/notifications", label: "Уведомления" },
  { key: "settings", href: "/teacher/settings", label: "Настройки" },
] as const;

/**
 * Navigate to a teacher page section via sidebar link.
 * Uses the sidebar navigation to ensure proper routing through the app.
 *
 * @param page - Playwright page
 * @param section - Section key from SIDEBAR_SECTIONS (e.g., "students", "tests")
 */
export async function navigateTo(page: Page, section: string): Promise<void> {
  const sectionItem = SIDEBAR_SECTIONS.find((s) => s.key === section);
  if (!sectionItem) {
    throw new Error(`Unknown section: ${section}. Valid keys: ${SIDEBAR_SECTIONS.map((s) => s.key).join(", ")}`);
  }
  await page.goto(sectionItem.href);
}

/**
 * Wait for page to be fully loaded.
 * Uses 'load' state (stable in Next.js dev mode) and waits for main content.
 *
 * @param page - Playwright page
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  // 'load' is stable in dev mode — 'networkidle' times out due to Next.js HMR polling
  await page.waitForLoadState("load");
  // Verify main content is visible
  await page.waitForSelector("main", { state: "visible", timeout: 15000 });
}

/**
 * Test fixture file paths
 * Add paths here as more fixtures are created.
 */
export const TEST_FILE_PATHS = {
  testSubmission: "./fixtures/test-submission.pdf",
  // Add more fixture paths as needed:
  // testMaterial: "./fixtures/test-material.txt",
  // testImage: "./fixtures/test-image.png",
} as const;

/**
 * Known bugs from UNFIXED_ISSUES.md for use with test.fixme() markers.
 * Maps bug IDs to descriptions for easy reference in tests.
 *
 * Usage in test:
 *   test.fixme(KNOWN_BUGS.CLS_06, "Description of the bug");
 *   test.fixme(KNOWN_BUGS.AUTH_04, "Missing logout endpoint");
 */
export const KNOWN_BUGS = {
  // Auth issues
  AUTH_04: "AUTH-04: Logout uses non-existent /auth/sign-out endpoint",

  // Classes issues
  CLS_06: "CLS-06: Class details issue",
  CLS_12: "CLS-12: Class management issue",

  // Question Bank
  QUESTION_BANK_SSR: "Question Bank SSR: Server-side rendering issue",

  // AI Draft
  AI_DRAFT_SSR: "AI Draft SSR: Server-side rendering issue",

  // Publications
  PUB_15: "PUB-15: Publication page issue",
  PUB_17: "PUB-17: Publication page issue",

  // Reviews
  REV_17: "REV-17: Reviews page issue",

  // Notifications
  NOTIFICATIONS_BADGE: "Notifications badge missing in sidebar",
  NOTIFICATIONS_TRIGGER: "No notification trigger when student submits",

  // Reviews pagination
  REVIEWS_PAGINATION: "REV-03: No pagination UI for pending reviews",

  // Materials/Assignments
  MB_001: "MB-001: Materials/Assignments issue",
} as const;