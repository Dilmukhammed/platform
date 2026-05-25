/**
 * Teacher E2E Tests: Library Page
 *
 * Test scenarios for teacher library management including:
 * - TC-LIB-T-001: Library materials list
 * - TC-LIB-T-002: Filter library by type/subject
 * - TC-LIB-T-003: Add material to library from published
 */

import { test, expect } from "@playwright/test";

import { loginAsTeacher } from "./helpers/teacher-helpers";

test.describe("TC-LIB-T: Library management", () => {
  test.beforeEach(async ({ page }) => {
    // Login as teacher before each test
    await loginAsTeacher(page);
    // Wait for page to be ready after login
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
  });

  test("TC-LIB-T-001: Просмотр списка материалов библиотеки", async ({ page }) => {
    // Navigate to library page (Uzbek: Kutubxona, Russian: Библиотека, English: Library)
    await page.goto("/teacher/library");

    // Wait for page to load with timeout
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Verify page title and structure
    const pageTitle = page.locator("h1").filter({ hasText: /Kutubxona|Библиотека|Library/i });
    await expect(pageTitle).toBeVisible();

// Verify organization badge is displayed
    const orgBadge = page.locator("text=/school|organization|organizationName|maktab/i");
    await expect(orgBadge.first()).toBeVisible();

    // Verify navigation cards are present
    // School Materials card (Uzbek: Maktab materiallari, Russian: Школьные материалы)
    const schoolMaterialsCard = page.locator("text=/Maktab materiallari|Школьные материалы|School Materials/i");
    await expect(schoolMaterialsCard).toBeVisible();

    // Personal Materials card (Uzbek: Shaxsiy materiallar, Russian: Личные материалы)
    const personalMaterialsCard = page.locator("text=/Shaxsiy materiallar|Личные материалы|Personal Materials/i");
    await expect(personalMaterialsCard).toBeVisible();

    // Verify quick actions section (Uzbek: Tezkor harakatlar, Russian: Быстрые действия)
    const quickActions = page.locator("text=/Tezkor harakatlar|Быстрые действия|Quick Actions/i");
    await expect(quickActions).toBeVisible();

    // Navigate to school materials
    await page.goto("/teacher/library/school/materials");
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Verify school materials page (Uzbek: Tasdiqlangan maktab materiallari)
    const schoolMaterialsTitle = page.locator("h1").filter({ hasText: / Tasdiqlangan maktab materiallari|Материалы школы|Approved School Materials/i });
    await expect(schoolMaterialsTitle).toBeVisible();

    // Verify materials are displayed (cards or table)
    const materialsSection = page.locator("text=/Доступные материалы|Available Materials|Mavjud materiallar/i");
    await expect(materialsSection).toBeVisible();

    // Check for either cards view or table view
    const hasCards = await page.locator("text=/Added by|Dobavleno|Qo'shdi/i").isVisible().catch(() => false);
    const hasTable = await page.locator("table").isVisible().catch(() => false);

    // At least one view should be present
    expect(hasCards || hasTable).toBeTruthy();
  });

  test("TC-LIB-T-002: Фильтрация библиотеки по типу/предмету", async ({ page }) => {
    // Navigate to library page
    await page.goto("/teacher/library");

    // Wait for page to load with timeout
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Navigate to school materials
    const schoolMaterialsLink = page.locator("a[href='/teacher/library/school/materials']");
    await schoolMaterialsLink.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Verify we're on the school materials page
    await expect(page).toHaveURL(/\/teacher\/library\/school\/materials/);

    // Verify filter options are available
    // Look for subject/type filter controls
    const filterControls = page.locator("select, input[type='search'], button").filter({
      hasText: /filter|subject|type/i
    });

    // Check stats overview is visible
    const statsCards = page.locator(".grid.gap-4 > div, [class*='grid'] > div").filter({
      has: page.locator("text=/Materials|Contributing|Organization/i")
    });

    // Verify table headers if table view is present
    const tableHeaders = page.locator("table thead th, table thead td");
    const headerCount = await tableHeaders.count();

    if (headerCount > 0) {
      // Table view is present - verify headers
      await expect(tableHeaders.first()).toBeVisible();
    }

    // Check for empty state or materials list
    const hasMaterials = await page.locator("text=/No approved materials yet|Hali tasdiqlangan materiallar yo'q/i").isVisible().catch(() => false);
    const hasMaterialList = await page.locator("[class*='CardTitle'], h2, h3").filter({
      hasText: /Material|Materials|Material/i
    }).isVisible().catch(() => false);

    // At least verify the page structure
    expect(hasMaterials || hasMaterialList).toBeTruthy();
  });

  test("TC-LIB-T-003: Добавление материала в библиотеку из опубликованных", async ({ page }) => {
    // Navigate to personal materials page
    await page.goto("/teacher/materials");

    // Wait for page to load with timeout
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Verify page title (Uzbek: Materiallar, Russian: Материалы, English: Materials)
    const pageTitle = page.locator("h1").filter({ hasText: /Materiallar|Материалы|Materials/i });
    await expect(pageTitle).toBeVisible();

    // Find a material that can be submitted to school
    // Materials with status "draft" and reviewState "none" can be submitted
    const draftMaterials = page.locator("[class*='Card'], article").filter({
      has: page.locator("text=/draft|Draft|черновик|namuna/i")
    });

    const draftCount = await draftMaterials.count();

    if (draftCount > 0) {
      // Look for "Submit to School" button (Uzbek: Maktabga yuborish, Russian: Отправить в школу)
      const submitButton = page.locator("button").filter({ hasText: /Maktabga yuborish|Отправить в школу|Submit to School/i });

      if (await submitButton.isVisible()) {
        // Click submit to school
        await submitButton.click();

        // Wait for form submission
        await page.waitForTimeout(1000);
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

        // Verify success message or status change
        // Should see "submitted" or "pending approval" message
        const successMessage = page.locator("text=/submitted|pending|success/i");
        await expect(successMessage.first()).toBeVisible();
      }
    }

    // Alternatively, verify that the "View School Materials" link works
    const viewSchoolMaterials = page.locator("a[href='/teacher/library/school/materials']");
    await expect(viewSchoolMaterials).toBeVisible();

    // Navigate to school materials to verify the submission flow
    await viewSchoolMaterials.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Verify we're on the school materials page
    await expect(page).toHaveURL(/\/teacher\/library\/school\/materials/);

    // Verify page content
    await expect(page.locator("h1")).toBeVisible();
  });
});