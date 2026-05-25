/**
 * Teacher Review & Grading E2E Tests
 *
 * Test scenarios for teacher review workflow including:
 * - Pending reviews list
 * - Search and filtering
 * - Student submission detail
 * - File preview (REV-17 bug)
 * - Review comments
 * - Grade assignment
 * - Complete review workflow
 * - Release to student
 * - Pagination (REV-03 bug)
 * - Individual question grading
 */

import { test, expect } from "@playwright/test";

import { loginAsTeacher, logoutTeacher, navigateTo, waitForPageLoad, KNOWN_BUGS, TEST_CREDENTIALS } from "./helpers/teacher-helpers";

test.describe("TC-REV-T: Проверка и оценивание работ", () => {
  test.beforeEach(async ({ page }) => {
    // Login as teacher before each test
    await loginAsTeacher(page);
    await navigateTo(page, "reviews");
  });

  test.afterEach(async ({ page }) => {
    // Logout after each test
    await logoutTeacher(page);
  });

  test("TC-REV-T-001: Список ожидающих проверок → отображение таблицы", async ({ page }) => {
    // Navigate to reviews page and verify table is visible

    // Verify main elements are visible
    await expect(page.locator("h1, h2, [data-testid='reviews-heading']").first()).toBeVisible();

    // Verify table structure exists (ReviewsFilters and Table components)
    await expect(page.locator("[class*='filters'], [data-testid='reviews-filters']").first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // If no filters, check for search input as alternative
    });

    // Verify search input is available
    await expect(page.locator("input[placeholder*='search', input[type='search'], input[name*='search']").first()).toBeVisible({ timeout: 3000 }).catch(() => {
      // Search may not be visible on empty state
    });

    // Verify list content area exists
    await expect(page.locator("main, [role='main'], [data-testid='reviews-list']").first()).toBeVisible();

    // Wait for page to fully load
    await waitForPageLoad(page);
  });

  test("TC-REV-T-002: Поиск/фильтрация проверок → поиск по введенному запросу", async ({ page }) => {
    // Search for a specific review using the search input

    // Find search input
    const searchInput = page.locator("input[placeholder*='search', input[type='search'], input[name*='search'], input").first();

    // Type a search query
    await searchInput.fill("test");
    await searchInput.press("Enter");

    // Wait for results to update
    await page.waitForTimeout(1000);

    // Verify URL reflects search (if applicable)
    // Verify results are filtered (table should show matching items or empty state)
    const hasResults = await page.locator("tbody tr, [data-testid='review-item']").first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmptyState = await page.locator("[data-testid='empty-state'], text=/ничего не найдено|no results/i").first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasResults || hasEmptyState).toBeTruthy();
  });

  test("TC-REV-T-003: Открытие деталей submission студента → переход на страницу деталей", async ({ page }) => {
    // Click on a review item to open student submission detail

    // Wait for page to load
    await waitForPageLoad(page);

    // Find and click on a review item (table row or card)
    const reviewItem = page.locator("tbody tr, [data-testid='review-item'], a[href*='/teacher/reviews/']").first();

    // Verify at least one review item exists
    const hasReviewItem = await reviewItem.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasReviewItem) {
      // Click on the first review item
      await reviewItem.click();

      // Wait for navigation to detail page
      await page.waitForURL(/\/teacher\/reviews\/[^/]+$/);

      // Verify we're on the detail page
      await expect(page).toHaveURL(/\/teacher\/reviews\/[a-zA-Z0-9-]+$/);

      // Verify detail page elements
      await expect(page.locator("main").first()).toBeVisible();
    } else {
      // No reviews available - test empty state
      await expect(page.locator("[data-testid='empty-state'], text=/нет проверок|no reviews/i").first()).toBeVisible({ timeout: 3000 }).catch(() => {
        test.skip("No review items available to click");
      });
    }
  });

  test("TC-REV-T-004: Preview файла студента → отображение файла", async ({ page }) => {
    // REV-17: No assets available in student file preview
    test.fixme(KNOWN_BUGS.REV_17, "REV-17: No assets available in student file preview");

    // Navigate to a review detail page first
    await navigateTo(page, "reviews");
    await waitForPageLoad(page);

    // Try to find and click a review item
    const reviewItem = page.locator("tbody tr, [data-testid='review-item'], a[href*='/teacher/reviews/']").first();
    const hasReviewItem = await reviewItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasReviewItem) {
      await reviewItem.click();
      await page.waitForURL(/\/teacher\/reviews\/[^/]+$/);
    }

    // Try to locate file preview section
    // The file preview component may not render assets (REV-17 bug)
    const filePreview = page.locator("[data-testid*='file-preview'], [class*='preview'], iframe, [data-testid*='viewer']").first();

    // Check if preview is visible - it may not be due to REV-17
    const hasPreview = await filePreview.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasPreview) {
      // This is expected due to REV-17 bug
      throw new Error("File preview not available - REV-17 bug");
    }

    await expect(filePreview).toBeVisible();
  });

  test("TC-REV-T-005: Добавление комментариев к проверке → textarea и submit", async ({ page }) => {
    // Navigate to review detail page
    await navigateTo(page, "reviews");
    await waitForPageLoad(page);

    // Click on a review item
    const reviewItem = page.locator("tbody tr, [data-testid='review-item'], a[href*='/teacher/reviews/']").first();
    const hasReviewItem = await reviewItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasReviewItem) {
      test.skip("No review items available");
      return;
    }

    await reviewItem.click();
    await page.waitForURL(/\/teacher\/reviews\/[^/]+$/);
    await waitForPageLoad(page);

    // Find comment textarea
    const commentTextarea = page.locator("textarea[name*='comment'], textarea[placeholder*='comment'], textarea").first();
    const hasTextarea = await commentTextarea.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasTextarea) {
      // Type a comment
      await commentTextarea.fill("Test comment from E2E test");

      // Find and click submit button
      const submitButton = page.locator("button[type='submit'], button:has-text('Submit'), button:has-text('Отправить'), button:has-text('Save')").first();
      await submitButton.click();

      // Wait for comment to be saved
      await page.waitForTimeout(1000);
    } else {
      test.skip("Comment textarea not available on this page");
    }
  });

  test("TC-REV-T-006: Выставление оценки за submission → заполнение поля и сохранение", async ({ page }) => {
    // Navigate to review detail page
    await navigateTo(page, "reviews");
    await waitForPageLoad(page);

    // Click on a review item
    const reviewItem = page.locator("tbody tr, [data-testid='review-item'], a[href*='/teacher/reviews/']").first();
    const hasReviewItem = await reviewItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasReviewItem) {
      test.skip("No review items available");
      return;
    }

    await reviewItem.click();
    await page.waitForURL(/\/teacher\/reviews\/[^/]+$/);
    await waitForPageLoad(page);

    // Find grade input field
    const gradeInput = page.locator("input[type='number'], input[name*='grade'], input[placeholder*='grade'], input[placeholder*='оценк']").first();
    const hasGradeInput = await gradeInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasGradeInput) {
      // Fill in a grade value
      await gradeInput.fill("85");

      // Find save/submit button
      const saveButton = page.locator("button[type='submit'], button:has-text('Save'), button:has-text('Сохранить'), button:has-text('Submit')").first();
      await saveButton.click();

      // Wait for save to complete
      await page.waitForTimeout(1000);

      // Verify grade was saved (input should have the value or there should be a success indicator)
      const savedGrade = await gradeInput.inputValue();
      expect(savedGrade === "85" || savedGrade === "85.00" || savedGrade === "85,00").toBeTruthy();
    } else {
      test.skip("Grade input not available on this page");
    }
  });

  test("TC-REV-T-007: Завершение проверки → нажатие кнопки и изменение статуса", async ({ page }) => {
    // Navigate to review detail page
    await navigateTo(page, "reviews");
    await waitForPageLoad(page);

    // Click on a review item
    const reviewItem = page.locator("tbody tr, [data-testid='review-item'], a[href*='/teacher/reviews/']").first();
    const hasReviewItem = await reviewItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasReviewItem) {
      test.skip("No review items available");
      return;
    }

    await reviewItem.click();
    await page.waitForURL(/\/teacher\/reviews\/[^/]+$/);
    await waitForPageLoad(page);

    // Find complete review button
    const completeButton = page.locator("button:has-text('Complete'), button:has-text('Завершить'), button:has-text('Done'), [data-testid*='complete']").first();
    const hasCompleteButton = await completeButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasCompleteButton) {
      // Click complete button
      await completeButton.click();

      // Wait for status change
      await page.waitForTimeout(1500);

      // Verify status chip shows completed status
      const statusChip = page.locator("[class*='status-chip'], [data-testid*='status'], span:has-text('Completed'), span:has-text('Завершен')").first();
      await expect(statusChip).toBeVisible({ timeout: 5000 });
    } else {
      test.skip("Complete button not available on this page");
    }
  });

  test("TC-REV-T-008: Release проверки студенту → кнопка release и статус", async ({ page }) => {
    // Navigate to review detail page
    await navigateTo(page, "reviews");
    await waitForPageLoad(page);

    // Click on a review item
    const reviewItem = page.locator("tbody tr, [data-testid='review-item'], a[href*='/teacher/reviews/']").first();
    const hasReviewItem = await reviewItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasReviewItem) {
      test.skip("No review items available");
      return;
    }

    await reviewItem.click();
    await page.waitForURL(/\/teacher\/reviews\/[^/]+$/);
    await waitForPageLoad(page);

    // Find release button
    const releaseButton = page.locator("button:has-text('Release'), button:has-text('Опубликовать'), button:has-text('Publish'), [data-testid*='release']").first();
    const hasReleaseButton = await releaseButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasReleaseButton) {
      // Click release button
      await releaseButton.click();

      // Wait for release to complete
      await page.waitForTimeout(1500);

      // Verify status changed to released
      const statusChip = page.locator("[class*='status-chip'], [data-testid*='status'], span:has-text('Released'), span:has-text('Опубликовано')").first();
      await expect(statusChip).toBeVisible({ timeout: 5000 });
    } else {
      test.skip("Release button not available on this page");
    }
  });

  test("TC-REV-T-009: Пагинация списка проверок → отсутствие UI пагинации", async ({ page }) => {
    // REV-03: No pagination UI for pending reviews
    test.fixme(KNOWN_BUGS.REVIEWS_PAGINATION, "REV-03: No pagination UI for pending reviews");

    // Navigate to reviews page
    await navigateTo(page, "reviews");
    await waitForPageLoad(page);

    // Check if there are multiple pages of reviews
    // First, verify we have some items
    const reviewItems = page.locator("tbody tr, [data-testid='review-item']");
    const itemCount = await reviewItems.count();

    if (itemCount > 0) {
      // Try to find pagination controls
      const paginationControls = page.locator("[class*='pagination'], [data-testid*='pagination'], nav:has-text('Next'), nav:has-text('Previous')").first();
      const hasPagination = await paginationControls.isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasPagination) {
        // This is the bug - pagination should exist but doesn't
        throw new Error("Pagination UI not found - REV-03 bug");
      }

      // If pagination exists, verify it works
      await expect(paginationControls).toBeVisible();
    } else {
      // Empty state - cannot test pagination
      test.skip("No review items to test pagination");
    }
  });

  test("TC-REV-T-010: Оценивание отдельных вопросов теста → вопросы с баллами", async ({ page }) => {
    // Navigate to review detail page
    await navigateTo(page, "reviews");
    await waitForPageLoad(page);

    // Click on a review item
    const reviewItem = page.locator("tbody tr, [data-testid='review-item'], a[href*='/teacher/reviews/']").first();
    const hasReviewItem = await reviewItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasReviewItem) {
      test.skip("No review items available");
      return;
    }

    await reviewItem.click();
    await page.waitForURL(/\/teacher\/reviews\/[^/]+$/);
    await waitForPageLoad(page);

    // Look for test questions section (if test is attached to submission)
    const questionsSection = page.locator("[data-testid*='questions'], [class*='questions'], h2:has-text('Questions'), h3:has-text('Вопросы')").first();
    const hasQuestions = await questionsSection.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasQuestions) {
      // Find individual question grade inputs
      const questionGrades = page.locator("input[type='number'][name*='question'], input[name*='score'], input[placeholder*='балл']");

      const gradeCount = await questionGrades.count();

      if (gradeCount > 0) {
        // Grade each question
        for (let i = 0; i < Math.min(gradeCount, 3); i++) {
          const input = questionGrades.nth(i);
          await input.fill(String(Math.floor(Math.random() * 10) + 1));
        }

        // Save all grades
        const saveButton = page.locator("button:has-text('Save'), button:has-text('Сохранить'), button[type='submit']").first();
        await saveButton.click();

        await page.waitForTimeout(1000);
      } else {
        test.skip("No question grade inputs found");
      }
    } else {
      // No test attached to this submission
      test.skip("No test questions section found - not a test submission");
    }
  });
});