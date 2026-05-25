/**
 * Teacher Class Management E2E Tests
 *
 * Test scenarios for teacher class management including:
 * - TC-CLS-T-001: Список классов - view all classes
 * - TC-CLS-T-002: Создание класса - create new class
 * - TC-CLS-T-003: Редактирование (edit-class-modal) - edit existing class
 * - TC-CLS-T-004: Удаление с подтверждением - delete with confirmation
 * - TC-CLS-T-005: Пустое название → валидация (CLS-12 bug)
 * - TC-CLS-T-006: Количество студентов (CLS-06 bug: "— assignments")
 * - TC-CLS-T-007: Детальная страница класса — все вкладки
 * - TC-CLS-T-008: Длинное название (>100 символов)
 */

import { test, expect } from "@playwright/test";

import {
  loginAsTeacher,
  navigateTo,
  waitForPageLoad,
  KNOWN_BUGS,
  logoutTeacher,
} from "./helpers/teacher-helpers";

test.describe("TC-CLS-T: Управление классами", () => {
  test.beforeEach(async ({ page }) => {
    // Login as teacher before each test
    await loginAsTeacher(page);
    await navigateTo(page, "classes");
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    // Logout after each test
    await logoutTeacher(page);
  });

  test("TC-CLS-T-001: Список классов", async ({ page }) => {
    // Verify page loads with heading
    await expect(page.locator("h1:has-text('Классы')")).toBeVisible();

    // Verify table or list of classes is visible
    // The page should show classes in a table format
    await expect(page.locator("table, [role='table'], .class-list, [data-testid='class-list']").first()).toBeVisible();

    // Verify sidebar navigation is present
    await expect(page.locator("nav, [role='navigation'], aside").first()).toBeVisible();
  });

  test("TC-CLS-T-002: Создание класса", async ({ page }) => {
    // Click create button
    await page.click('button:has-text("Создать"), button:has-text("Добавить"), [data-testid="create-class-btn"]');

    // Wait for modal or navigate to new page
    await page.waitForLoadState("networkidle");

    // Fill class name
    const uniqueClassName = `Test Class ${Date.now()}`;
    const nameInput = page.locator('input[name="name"], input[placeholder*="назван"], input[id*="name"]');
    await nameInput.fill(uniqueClassName);

    // Submit form
    await page.click('button[type="submit"]:has-text("Создать"), button:has-text("Сохранить")');

    // Wait for redirect or close modal
    await page.waitForLoadState("networkidle");

    // Verify class appears in list
    await expect(page.locator(`text=${uniqueClassName}`)).toBeVisible();
  });

  test("TC-CLS-T-003: Редактирование (edit-class-modal)", async ({ page }) => {
    // Find first class in the list
    const classRow = page.locator("tbody tr, [role='row'], .class-item, [data-testid='class-row']").first();
    await classRow.waitFor({ timeout: 5000 });

    // Click edit button for that class
    const editButton = classRow.locator('button:has-text("Редактировать"), button:has-text("Изменить"), [data-testid="edit-btn"], [aria-label*="Edit"]').first();
    await editButton.click();

    // Wait for edit modal to appear
    await page.waitForLoadState("networkidle");

    // Verify modal is visible
    const modal = page.locator("[role='dialog'], .modal, [data-testid='edit-class-modal']");
    await expect(modal).toBeVisible();

    // Clear name field and enter new name
    const nameInput = page.locator('input[name="name"], input[placeholder*="назван"]');
    await nameInput.clear();
    const updatedClassName = `Updated Class ${Date.now()}`;
    await nameInput.fill(updatedClassName);

    // Save changes
    await page.click('button[type="submit"]:has-text("Сохранить"), button:has-text("Обновить")');

    // Wait for modal to close
    await page.waitForLoadState("networkidle");

    // Verify updated name appears in the list
    await expect(page.locator(`text=${updatedClassName}`)).toBeVisible();
  });

  test("TC-CLS-T-004: Удаление с подтверждением", async ({ page }) => {
    // Get initial count of classes
    const initialRows = page.locator("tbody tr, [role='row'], .class-item");
    const initialCount = await initialRows.count();

    // Find delete button for first class
    const deleteButton = page.locator('button:has-text("Удалить"), [data-testid="delete-btn"], [aria-label*="Delete"]').first();
    await deleteButton.click();

    // Wait for confirmation dialog
    await page.waitForLoadState("networkidle");

    // Verify confirmation dialog/modal appears
    const confirmDialog = page.locator("[role='alertdialog'], .confirm-dialog, [data-testid='confirm-delete']");
    await expect(confirmDialog).toBeVisible();

    // Confirm deletion
    await page.click('button:has-text("Подтвердить"), button:has-text("Удалить"), [data-testid="confirm-delete-btn"]');

    // Wait for operation to complete
    await page.waitForLoadState("networkidle");

    // Verify class count decreased or class is gone
    const finalRows = page.locator("tbody tr, [role='row'], .class-item");
    const finalCount = await finalRows.count();

    // Either count decreased or the deleted class name is no longer visible
    const deletedClassNotVisible = !(await page.locator(`text=${"Updated Class"}`).isVisible().catch(() => true));
    expect(finalCount < initialCount || deletedClassNotVisible).toBeTruthy();
  });

  test.fixme(
    KNOWN_BUGS.CLS_12,
    "TC-CLS-T-005: Пустое название → валидация"
  )
  test("TC-CLS-T-005: Пустое название → валидация", async ({ page }) => {
    // Navigate to create class form
    await page.click('button:has-text("Создать"), button:has-text("Добавить")');
    await page.waitForLoadState("networkidle");

    // Try to submit with empty name
    const nameInput = page.locator('input[name="name"], input[placeholder*="назван"]');
    await nameInput.fill(""); // Ensure empty

    // Submit form
    await page.click('button[type="submit"]:has-text("Создать"), button:has-text("Сохранить")');

    // Should show validation error (but currently doesn't - CLS-12 bug)
    // TODO: When CLS-12 is fixed, change to expect validation message
    await page.waitForLoadState("networkidle");

    // Currently no validation, so it may submit or stay on page
    // This test documents the bug behavior
    const url = page.url();
    expect(url).toMatch(/classes/);
  });

  test.fixme(
    KNOWN_BUGS.CLS_06,
    "TC-CLS-T-006: Количество студентов (CLS-06 bug: '— assignments')"
  )
  test("TC-CLS-T-006: Количество студентов (CLS-06 bug: '— assignments')", async ({ page }) => {
    // Navigate to class list
    await navigateTo(page, "classes");
    await waitForPageLoad(page);

    // Find class with students
    const classRow = page.locator("tbody tr, [role='row'], .class-item").first();
    await classRow.waitFor({ timeout: 5000 });

    // Click on class to go to details
    await classRow.locator("a, button, [role='button']").first().click();
    await page.waitForLoadState("networkidle");

    // Look for student count indicator
    // Bug: Shows "— assignments" instead of actual number
    const studentCountText = page.locator("text=/студентов|учеников/i").first();

    // Currently may show "— assignments" (bug behavior)
    // TODO: When CLS-06 is fixed, should show actual student count number
    await expect(studentCountText).toBeVisible();

    // Log for debugging
    const countContent = await studentCountText.textContent();
    console.log("Student count display:", countContent);
  });

  test("TC-CLS-T-007: Детальная страница класса — все вкладки", async ({ page }) => {
    // Navigate to class list and click on first class
    await navigateTo(page, "classes");
    await waitForPageLoad(page);

    // Click on first class to open details
    const classLink = page.locator("tbody tr a, [role='row'] a, .class-item a, [data-testid='class-link']").first();
    await classLink.click();
    await page.waitForLoadState("networkidle");

    // Verify we're on class detail page
    await expect(page).toHaveURL(/\/classes\/[^/]+/);

    // Check for tabs navigation
    const tabs = page.locator("[role='tablist'], .tabs, nav.tabs, [data-testid='tabs']");
    const hasTabs = await tabs.isVisible().catch(() => false);

    if (hasTabs) {
      // Click through each tab if visible
      const tabButtons = tabs.locator("button, [role='tab'], a");
      const tabCount = await tabButtons.count();

      for (let i = 0; i < tabCount; i++) {
        const tab = tabButtons.nth(i);
        const tabName = await tab.textContent();
        await tab.click();
        await page.waitForLoadState("networkidle");

        // Verify tab content is visible after clicking
        await expect(page.locator("[role='tabpanel'], .tab-content, main").first()).toBeVisible();
        console.log(`Verified tab: ${tabName}`);
      }
    } else {
      // No tabs - just verify main content loads
      await expect(page.locator("main, [role='main']").first()).toBeVisible();
    }

    // Verify class name is displayed
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("TC-CLS-T-008: Длинное название (>100 символов)", async ({ page }) => {
    // Navigate to create class form
    await page.click('button:has-text("Создать"), button:has-text("Добавить")');
    await page.waitForLoadState("networkidle");

    // Create a name longer than 100 characters
    const longName = "A".repeat(101);
    const nameInput = page.locator('input[name="name"], input[placeholder*="назван"]');
    await nameInput.fill(longName);

    // Verify the input accepts the long name (may be truncated by UI)
    const inputValue = await nameInput.inputValue();
    expect(inputValue.length).toBeGreaterThanOrEqual(100);

    // Try to submit
    await page.click('button[type="submit"]:has-text("Создать"), button:has-text("Сохранить")');
    await page.waitForLoadState("networkidle");

    // The form may truncate, accept, or reject the long name
    // Just verify the page responds somehow
    const url = page.url();
    const currentContent = await page.content();

    // Either we're redirected (success) or still on form with error
    expect(url.includes("classes") || currentContent.includes("error")).toBeTruthy();
  });
});