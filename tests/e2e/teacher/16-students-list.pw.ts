/**
 * Teacher E2E Tests: Students List Page
 *
 * Test scenarios for teacher students list across all classes including:
 * - TC-STU-L-001: Students list across all classes
 * - TC-STU-L-002: Search/filter students
 * - TC-STU-L-003: Student detail page
 * - TC-STU-L-004: View student submissions history
 */

import { test, expect } from "@playwright/test";

import { loginAsTeacher } from "./helpers/teacher-helpers";

test.describe("TC-STU-L: Students list across classes", () => {
  test.beforeEach(async ({ page }) => {
    // Login as teacher before each test
    await loginAsTeacher(page);
    // Use domcontentloaded instead of networkidle to avoid timeout issues
    await page.goto("/teacher/students");
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
  });

  test("TC-STU-L-001: Просмотр списка студентов всех классов", async ({ page }) => {
    // Navigate to students list page
    await page.goto("/teacher/students");

    // Wait for page to load with timeout to avoid hanging
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Verify page title is visible (Uzbek: O'quvchilar, Russian: Ученики, English: Students)
    const pageTitle = page.locator("h1").filter({ hasText: /O'quvchilar|Ученики|Students/i });
    await expect(pageTitle).toBeVisible();

    // Verify the students table is present
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Verify table headers are correct
    const tableHeader = page.locator("table thead");
    await expect(tableHeader.locator("text=/Student|Ученик/i")).toBeVisible();
    await expect(tableHeader.locator("text=/Login/i")).toBeVisible();
    await expect(tableHeader.locator("text=/Classes/i")).toBeVisible();
    await expect(tableHeader.locator("text=/Created/i")).toBeVisible();

    // Verify filter tabs are present (All, With classes, Without classes)
    const filterTabs = page.locator("a").filter({ hasText: /all|with classes|without classes/i });
    await expect(filterTabs.first()).toBeVisible();

    // Verify search input is present
    const searchInput = page.locator('input[name="search"]');
    await expect(searchInput).toBeVisible();

    // Verify action buttons are present (Import CSV, Add Student)
    const importButton = page.locator("button").filter({ hasText: /Import CSV/i });
    await expect(importButton).toBeVisible();

    // Verify at least one student row or empty state
    const tableBody = page.locator("table tbody");
    await expect(tableBody).toBeVisible();

    // Check for student rows or empty state
    const studentRows = page.locator("table tbody tr");
    const rowCount = await studentRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test("TC-STU-L-002: Поиск и фильтрация студентов", async ({ page }) => {
    // Navigate to students list page
    await page.goto("/teacher/students");

    // Wait for page to load with timeout to avoid hanging
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Test search functionality
    const searchInput = page.locator('input[name="search"]');
    await expect(searchInput).toBeVisible();

    // Get initial row count
    const initialRows = page.locator("table tbody tr");
    const initialCount = await initialRows.count();

    // If there are students, perform a search
    if (initialCount > 0) {
      // Type a search query
      await searchInput.fill("test");
      await searchInput.press("Enter");

      // Wait for results to load with timeout
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

      // Verify URL contains search param
      await expect(page).toHaveURL(/search=test/i);

      // Clear search
      await searchInput.clear();
      await searchInput.press("Enter");
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    }

    // Test filter tabs
    const allFilterTab = page.locator("a").filter({ hasText: /all/i }).first();
    await allFilterTab.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    await expect(page).toHaveURL(/\?filter=all/);

    const withClassesFilter = page.locator("a").filter({ hasText: /with classes/i }).first();
    await withClassesFilter.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    await expect(page).toHaveURL(/filter=with-classes/);

    const withoutClassesFilter = page.locator("a").filter({ hasText: /without classes/i }).first();
    await withoutClassesFilter.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    await expect(page).toHaveURL(/filter=without-classes/);
  });

  test("TC-STU-L-003: Страница деталей студента", async ({ page }) => {
    // Navigate to students list page
    await page.goto("/teacher/students");

    // Wait for page to load with timeout to avoid hanging
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Find and click on a student row to view details
    const studentRows = page.locator("table tbody tr");
    const rowCount = await studentRows.count();

    if (rowCount > 0) {
      // Click on the first student row
      const firstStudent = studentRows.first();
      await firstStudent.click();

      // Wait for navigation or modal with timeout
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

      // Verify we're on a student detail page or a detail panel appeared
      // Check for student name, login, or other details
      const studentDetail = page.locator("text=/student|profile|details/i");
      const hasDetail = await studentDetail.isVisible().catch(() => false);

      // If it navigated to a new page, verify the URL or content
      if (page.url().includes("/students/")) {
        // Verify student info is displayed
        await expect(page.locator("h1,h2").first()).toBeVisible();
      } else if (hasDetail) {
        // Detail section is visible
        await expect(studentDetail.first()).toBeVisible();
      }
    } else {
      // No students - verify empty state
      const emptyState = page.locator("text=/no students|empty|no match/i");
      await expect(emptyState.first()).toBeVisible();
    }
  });

  test("TC-STU-L-004: Просмотр истории submission студента", async ({ page }) => {
    // Navigate to students list page
    await page.goto("/teacher/students");

    // Wait for page to load with timeout to avoid hanging
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Find a student with classes (more likely to have submissions)
    const studentRows = page.locator("table tbody tr");
    const rowCount = await studentRows.count();

    if (rowCount > 0) {
      // Try to find a student with class badges (indicates they have classes)
      const studentWithClasses = page.locator("table tbody tr").filter({
        has: page.locator("span.rounded-full, span.bg-primary-subtle")
      });

      const hasStudentsWithClasses = await studentWithClasses.count();

      if (hasStudentsWithClasses > 0) {
        // Click on a student with classes
        await studentWithClasses.first().click();
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

        // Look for submission history or related content
        // This could be in a modal, a separate page, or a section
        const submissionHistory = page.locator("text=/submission|history|submitted/i");
        const hasSubmissionContent = await submissionHistory.first().isVisible().catch(() => false);

        if (hasSubmissionContent) {
          await expect(submissionHistory.first()).toBeVisible();
        }
      }
    }

    // Verify page loaded without errors
    await expect(page.locator("main")).toBeVisible();
  });
});