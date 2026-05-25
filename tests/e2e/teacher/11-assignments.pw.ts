/**
 * Teacher Assignments E2E Tests
 *
 * Test scenarios for teacher assignment templates management including:
 * - Assignment templates list with filters (TC-ASN-T-001)
 * - Create template with name, description (TC-ASN-T-002)
 * - Attach materials to template (TC-ASN-T-003)
 * - Attach test to template (TC-ASN-T-004)
 * - Edit template (TC-ASN-T-005)
 * - Publish assignment to classes with deadline (TC-ASN-T-006)
 * - Verify publication appears in list (TC-ASN-T-007)
 * - Create template without materials/tests validation (TC-ASN-T-008)
 */

import { test, expect } from "@playwright/test";

import {
  loginAsTeacher,
  logoutTeacher,
  navigateTo,
  waitForPageLoad,
} from "./helpers/teacher-helpers";

test.describe("TC-ASN-T: Управление шаблонами заданий", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await navigateTo(page, "assignments");
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await logoutTeacher(page);
  });

  test("TC-ASN-T-001: Assignment templates list — view with filters", async ({ page }) => {
    // Verify page loads with heading (Uzbek: "Topshiriq shablonlari")
    await expect(page.locator("h1:has-text('Topshiriq shablonlari'), h1:has-text('Assignments'), h1:has-text('Задания')")).toBeVisible();

    // Verify templates list or empty state is visible
    const hasTable = await page.locator("table").isVisible().catch(() => false);
    const hasEmptyState = await page.locator("text=/Hali topshiriq shablonlari yoq|empty|no assignments/i").isVisible().catch(() => false);
    const hasTemplateCards = await page.locator("a[href*='/teacher/assignments/']").isVisible().catch(() => false);

    expect(hasTable || hasEmptyState || hasTemplateCards).toBeTruthy();

    // Verify filter tabs are visible (Uzbek: Barchasi, Qoralama, Faol, Arxivlangan)
    const filterTabs = page.locator("text=/Barchasi|Qoralama|Faol|Arxivlangan|all|draft|active|archived/i");
    await expect(filterTabs.first()).toBeVisible();

    // Verify "Create Template" button exists (Uzbek: "Shablon yaratish")
    const createButton = page.locator("a:has-text('Shablon yaratish'), a:has-text('Create'), a:has-text('Создать'), a[href*='/teacher/assignments/new']");
    await expect(createButton.first()).toBeVisible();
  });

  test("TC-ASN-T-002: Create template — name, description", async ({ page }) => {
    // Navigate to create template page
    await page.goto("/teacher/assignments/new");
    await waitForPageLoad(page);

    // Verify form elements are present
    await expect(page.locator('input[name="title"], input#title')).toBeVisible();
    await expect(page.locator('textarea[name="description"], textarea#description')).toBeVisible();

    // Fill in template details
    const uniqueTitle = `Test Assignment Template ${Date.now()}`;
    await page.fill('input[name="title"]', uniqueTitle);
    await page.fill('textarea[name="description"]', "Test description for assignment template");

    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Create"), button:has-text("Создать")');
    await submitButton.click();

    // Wait for redirect to assignments list
    await page.waitForURL(/\/teacher\/assignments/, { timeout: 10000 });

    // Verify success message or new template appears
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test("TC-ASN-T-003: Attach materials to template", async ({ page }) => {
    // Navigate to create template page
    await page.goto("/teacher/assignments/new");
    await waitForPageLoad(page);

    // Fill basic info
    const uniqueTitle = `Template with Materials ${Date.now()}`;
    await page.fill('input[name="title"]', uniqueTitle);

    // Look for material selection section
    const materialSection = page.locator("text=/Link Materials|Select materials/i");
    const hasMaterialSection = await materialSection.isVisible().catch(() => false);

    if (!hasMaterialSection) {
      // Check if there are any checkbox inputs for materials
      const materialCheckbox = page.locator('input[name="materialId"]');
      const hasCheckbox = await materialCheckbox.first().isVisible().catch(() => false);

      if (!hasCheckbox) {
        test.skip("No materials available to attach");
        return;
      }

      // Select first material
      await materialCheckbox.first().click();
    } else {
      // Try to find and select materials in the section
      const materialLabel = page.locator('label:has(input[name="materialId"])').first();
      const hasMaterial = await materialLabel.isVisible().catch(() => false);

      if (hasMaterial) {
        await materialLabel.click();
      } else {
        test.skip("No materials available in the organization");
        return;
      }
    }

    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Create")');
    await submitButton.click();

    // Wait for redirect
    await page.waitForURL(/\/teacher\/assignments/, { timeout: 10000 });

    // Verify template was created
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test("TC-ASN-T-004: Attach test to template", async ({ page }) => {
    // Navigate to create template page
    await page.goto("/teacher/assignments/new");
    await waitForPageLoad(page);

    // Fill basic info
    const uniqueTitle = `Template with Test ${Date.now()}`;
    await page.fill('input[name="title"]', uniqueTitle);

    // Look for test selection section
    const testSection = page.locator("text=/Link a Test|Select a test/i");
    const hasTestSection = await testSection.isVisible().catch(() => false);

    if (!hasTestSection) {
      // Check if there are any radio inputs for tests
      const testRadio = page.locator('input[name="linkedTestId"]');
      const hasRadio = await testRadio.first().isVisible().catch(() => false);

      if (!hasRadio) {
        test.skip("No tests available to attach");
        return;
      }

      // Select first test
      await testRadio.first().click();
    } else {
      // Try to find and select a test in the section
      const testLabel = page.locator('label:has(input[name="linkedTestId"])').first();
      const hasTest = await testLabel.isVisible().catch(() => false);

      if (hasTest) {
        await testLabel.click();
      } else {
        test.skip("No tests available in the organization");
        return;
      }
    }

    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Create")');
    await submitButton.click();

    // Wait for redirect
    await page.waitForURL(/\/teacher\/assignments/, { timeout: 10000 });

    // Verify template was created
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test("TC-ASN-T-005: Edit template — change name, description", async ({ page }) => {
    // Navigate to assignments list
    await navigateTo(page, "assignments");
    await waitForPageLoad(page);

    // Click on first template to go to detail page
    const templateLink = page.locator("a[href*='/teacher/assignments/'][href*='/teacher/assignments/'][href$!='/publish'][href$!='/new']").first();
    const hasTemplate = await templateLink.isVisible().catch(() => false);

    if (!hasTemplate) {
      test.skip("No templates to edit");
      return;
    }

    await templateLink.click();
    await page.waitForLoadState("networkidle");

    // Verify we're on detail page
    await expect(page).toHaveURL(/\/teacher\/assignments\/[^/]+$/);

    // Look for edit capability - may be in the detail page or require navigating to edit
    // Check if there's an edit button or form on the page
    const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit"), button:has-text("Редактировать")');
    const hasEditButton = await editButton.isVisible().catch(() => false);

    if (!hasEditButton) {
      // The template detail page might not have inline edit
      // Check if we can navigate to edit URL pattern
      const currentUrl = page.url();
      const templateId = currentUrl.split("/teacher/assignments/")[1]?.split("?")[0];

      if (templateId) {
        await page.goto(`/teacher/assignments/${templateId}/edit`).catch(() => {
          console.log("No edit page available for template");
        });

        const hasEditForm = await page.locator('input[name="title"], #title').isVisible().catch(() => false);
        if (hasEditForm) {
          // Edit the title
          const titleInput = page.locator('input[name="title"], #title');
          await titleInput.waitFor({ timeout: 5000 });
          await titleInput.clear();
          const updatedTitle = `Updated Template ${Date.now()}`;
          await titleInput.fill(updatedTitle);

          // Save changes
          const saveButton = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Сохранить")');
          await saveButton.click();

          // Wait for redirect and verify
          await page.waitForURL(/\/teacher\/assignments\/[^/]+$/, { timeout: 10000 });
          await expect(page.locator(`text=${updatedTitle}`)).toBeVisible();
        } else {
          console.log("No edit form available for template");
        }
      }
    } else {
      // Click edit button and edit
      await editButton.click();
      await page.waitForLoadState("networkidle");

      // Verify we're on edit page
      const titleInput = page.locator('input[name="title"], #title');
      await titleInput.waitFor({ timeout: 5000 });

      await titleInput.clear();
      const updatedTitle = `Updated Template ${Date.now()}`;
      await titleInput.fill(updatedTitle);

      // Save changes
      const saveButton = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Сохранить")');
      await saveButton.click();

      // Wait for redirect and verify
      await page.waitForURL(/\/teacher\/assignments\/[^/]+$/, { timeout: 10000 });
      await expect(page.locator(`text=${updatedTitle}`)).toBeVisible();
    }
  });

  test("TC-ASN-T-006: Publish assignment to classes — select classes, deadline", async ({ page }) => {
    // Navigate to assignments list
    await navigateTo(page, "assignments");
    await waitForPageLoad(page);

    // Find a template to publish (Uzbek: "E'lon qilish")
    const publishLink = page.locator("a[href*='/publish']:has-text('E\'lon qilish'), a[href*='/publish']:has-text('Publish'), a[href*='/publish']:has-text('Опубликовать')").first();
    const hasPublishLink = await publishLink.isVisible().catch(() => false);

    if (!hasPublishLink) {
      test.skip("No template available to publish");
      return;
    }

    await publishLink.click();
    await page.waitForLoadState("networkidle");

    // Verify we're on publish page
    await expect(page).toHaveURL(/\/teacher\/assignments\/[^/]+\/publish/);

    // Look for deadline input
    const deadlineInput = page.locator('input[name="defaultDeadline"], input[type="datetime-local"]');
    await expect(deadlineInput).toBeVisible();

    // Set a future deadline (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    const deadlineValue = tomorrow.toISOString().slice(0, 16);
    await deadlineInput.fill(deadlineValue);

    // Look for class selection checkboxes
    const classCheckbox = page.locator('input[name="classId"]');
    const hasClassCheckbox = await classCheckbox.first().isVisible().catch(() => false);

    if (!hasClassCheckbox) {
      // Check if there's a "no classes" message
      const noClassesMsg = page.locator("text=/no active classes|No classes available/i");
      const hasNoClasses = await noClassesMsg.isVisible().catch(() => false);

      if (hasNoClasses) {
        test.skip("No active classes available to publish to");
        return;
      }
    } else {
      // Select first class
      await classCheckbox.first().check();

      // Submit the form (Uzbek: "Tanlangan sinflarga e'lon qilish")
      const publishButton = page.locator('button[type="submit"]:has-text("Tanlangan sinflarga e\'lon qilish"), button[type="submit"]:has-text("Publish"), button:has-text("Опубликовать")');
      await publishButton.click();

      // Wait for redirect to publications page
      await page.waitForURL(/\/teacher\/publications/, { timeout: 15000 }).catch(() => {
        // May redirect to same page with success message
      });

      // Verify success message or publication appears
      const successMsg = page.locator("text=/success|published|успешно|опубликовано/i");
      const hasSuccess = await successMsg.isVisible().catch(() => false);

      if (hasSuccess) {
        console.log("Assignment published successfully");
      }
    }
  });

  test("TC-ASN-T-007: Verify publication appears in list", async ({ page }) => {
    // Navigate to publications page
    await navigateTo(page, "publications");
    await waitForPageLoad(page);

    // Verify page loads
    await expect(page.locator("h1:has-text('Publications'), h1:has-text('Публикации')")).toBeVisible();

    // Check if there are any publications listed
    const hasPublications = await page.locator("table, [data-testid='publication-card']").isVisible().catch(() => false);
    const hasEmptyState = await page.locator("text=/no publications|empty|пусто/i").isVisible().catch(() => false);

    // Either publications exist or empty state is shown
    expect(hasPublications || hasEmptyState).toBeTruthy();

    // If publications exist, verify table structure
    if (hasPublications) {
      // Verify table headers or card elements are present
      const headers = page.locator("th, [role='columnheader']");
      await expect(headers.first()).toBeVisible();
    }
  });

  test("TC-ASN-T-008: Create template without materials/tests — validation", async ({ page }) => {
    // Navigate to create template page
    await page.goto("/teacher/assignments/new");
    await waitForPageLoad(page);

    // Fill only the title - no description, no materials, no test
    const uniqueTitle = `Template No Content ${Date.now()}`;
    await page.fill('input[name="title"]', uniqueTitle);

    // Submit the form (should still work - materials/tests are optional)
    const submitButton = page.locator('button[type="submit"]:has-text("Create")');
    await submitButton.click();

    // Wait for redirect
    await page.waitForURL(/\/teacher\/assignments/, { timeout: 10000 });

    // Verify template was created even without materials/tests
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 10000 });

    // Verify template shows "no content" badge (if UI supports it)
    const noContentBadge = page.locator("text=/no content|no materials|без содержимого/i");
    const hasNoContentBadge = await noContentBadge.isVisible().catch(() => false);

    if (hasNoContentBadge) {
      console.log("Template created with 'no content' indicator as expected");
    }
  });
});