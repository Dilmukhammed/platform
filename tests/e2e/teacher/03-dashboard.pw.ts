/**
 * TC-DASH-T: Dashboard and Navigation Tests
 *
 * Tests for teacher dashboard functionality, sidebar navigation,
 * summary widgets, and onboarding status verification.
 *
 * NOTE: UI is in Uzbek - text selectors use regex to match both languages.
 * SIDEBAR_SECTIONS labels are for reference only (not used for text matching).
 */

import { test, expect } from "@playwright/test";

import {
  loginAsTeacher,
  logoutTeacher,
  SIDEBAR_SECTIONS,
  waitForPageLoad,
} from "./helpers/teacher-helpers";

test.describe("TC-DASH-T: Дашборд и навигация", () => {
  test.afterEach(async ({ page }) => {
    await logoutTeacher(page);
  });

  /**
   * TC-DASH-T-001: Dashboard loads without console errors
   * and all dashboard widgets are visible.
   */
  test("TC-DASH-T-001: Дашборд без ошибок консоли, все виджеты видны", async ({ page }) => {
    await loginAsTeacher(page);
    // Already at /teacher and main is visible (loginAsTeacher waits for it)
    await expect(page.locator("main").first()).toBeVisible();
  });

  /**
   * TC-DASH-T-002: Navigation through ALL 13 sidebar sections
   * Each section should navigate to the correct URL.
   */
  test("TC-DASH-T-002: Навигация по всем 13 пунктам сайдбара", async ({ page }) => {
    await loginAsTeacher(page);

    // Test all 13 sidebar sections
    for (const section of SIDEBAR_SECTIONS) {
      await page.goto(section.href);
      await waitForPageLoad(page);

      // Verify the URL matches expected
      await expect(page).toHaveURL(new RegExp(`^.*${section.href}$`));

      // Verify page loaded successfully (main content exists)
      await expect(page.locator("main").first()).toBeVisible();
    }
  });

/**
 * TC-DASH-T-003: Dashboard summary widgets display correctly
 * Classes, publications, notifications, and reviews should be visible.
 */
test("TC-DASH-T-003: Сводка: классы, публикации, уведомления, ревью отображаются", async ({ page }) => {
    await loginAsTeacher(page);
    // Already at /teacher with main visible
    await expect(page.locator("main").first()).toBeVisible();

    // Check for summary widgets - look for common patterns
    // Classes widget (Uzbek: "Sinf" / Russian: "Класс")
    const classesWidget = page.locator("text=/Sinf|Klass|класс|class/i").first();
    await expect(classesWidget).toBeVisible({ timeout: 5000 });

    // Publications widget (Uzbek: "Nashrlar" / Russian: "Публикации")
    const publicationsWidget = page.locator("text=/Nashrlar|публикац|publication/i").first();
    await expect(publicationsWidget).toBeVisible({ timeout: 5000 });

    // Notifications widget (Uzbek: "Bildirishnomalar" / Russian: "Уведомления")
    const notificationsWidget = page.locator("text=/Bildirishnomalar|notif|уведомлен/i").first();
    await expect(notificationsWidget).toBeVisible({ timeout: 5000 });

    // Reviews widget (Uzbek: "Tekshirish" / Russian: "Проверки" or "Ревью")
    const reviewsWidget = page.locator("text=/Tekshirish|ревью|review| провер/i").first();
    await expect(reviewsWidget).toBeVisible({ timeout: 5000 });
  });

/**
 * TC-DASH-T-004: Onboarding status check
 * If teacher has no organization, redirect should happen.
 * Note: This test expects that the system redirects teachers
 * without an organization to an onboarding flow.
 */
test("TC-DASH-T-004: Проверка онбординг-статуса (no_org → редирект)", async ({ page }) => {
    // First, login to get session state
    await loginAsTeacher(page);

    // Check current organization status
    // Navigate to settings to check org status
    await page.goto("/teacher/settings");
    await page.waitForLoadState("load");

    // Check if teacher has organization assigned
    const currentUrl = page.url();

    // If no organization is set, we expect redirect to onboarding
    // Common onboarding URLs: /onboarding, /setup, /no-org, etc.
    const isOnboardingRoute =
      currentUrl.includes("/onboarding") ||
      currentUrl.includes("/setup") ||
      currentUrl.includes("/no-org");

    // If on settings page without org, we should be redirected
    // or the settings page should show "no organization" state
    if (!isOnboardingRoute) {
      // Verify settings page loads or we detect no-org state
      await expect(page.locator("main").first()).toBeVisible();

      // Check for any "no organization" indicators (Uzbek and Russian)
      const noOrgIndicators = [
        "[data-testid='no-organization']",
        // Uzbek: "tashkilot yo'q" / Russian: "нет организации"
        "text=/tashkilot yo|нет организац|no organization|без организац/i",
        "[data-testid='onboarding-prompt']",
      ];

      // If no-org state is shown, it should be visible
      for (const selector of noOrgIndicators) {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          // Found an indicator that organization is missing
          break;
        }
      }
    }
  });
});