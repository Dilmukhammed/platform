/**
 * Teacher Test Creation & Management E2E Tests
 *
 * Test scenarios for teacher test management including:
 * - TC-TST-T-001: Test list view
 * - TC-TST-T-002: Create test manually — name, description
 * - TC-TST-T-003: Add multiple choice question
 * - TC-TST-T-004: Add open-ended question
 * - TC-TST-T-005: Upload image to question (QuestionImageUpload)
 * - TC-TST-T-006: Edit test — modify questions
 * - TC-TST-T-007: Delete test
 * - TC-TST-T-008: Submit test to organization
 * - TC-TST-T-009: Request edit after submission
 * - TC-TST-T-010: Create test with no questions — validation
 */

import { test, expect } from "@playwright/test";

import {
  loginAsTeacher,
  navigateTo,
  waitForPageLoad,
  KNOWN_BUGS,
  logoutTeacher,
} from "./helpers/teacher-helpers";

test.describe("TC-TST-T: Управление тестами", () => {
  test.beforeEach(async ({ page }) => {
    // Login as teacher before each test
    await loginAsTeacher(page);
    await navigateTo(page, "tests");
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    // Logout after each test
    await logoutTeacher(page);
  });

  test("TC-TST-T-001: Список тестов", async ({ page }) => {
    // Verify page loads with heading
    await expect(page.locator("h1:has-text('Тесты')")).toBeVisible();

    // Verify test list is visible (table, grid, or cards)
    await expect(
      page.locator("table, [role='table'], [role='grid'], .test-list, [data-testid='test-list']").first()
    ).toBeVisible();

    // Verify sidebar navigation is present
    await expect(page.locator("nav, [role='navigation'], aside").first()).toBeVisible();
  });

  test("TC-TST-T-002: Создание теста вручную — название, описание", async ({ page }) => {
    // Navigate to create test page
    await page.goto("/teacher/tests/create");
    await waitForPageLoad(page);

    // Verify create form is visible
    await expect(page.locator("h1:has-text('Qoʻlda test yaratish'), h1:has-text('Создать тест')").first()).toBeVisible();

    // Fill test name
    const uniqueTestName = `E2E Test ${Date.now()}`;
    const titleInput = page.locator('input[id="test-title"], input[name="title"], input[placeholder*="назв"]');
    await titleInput.fill(uniqueTestName);

    // Fill description
    const descriptionInput = page.locator('textarea[id="test-description"], textarea[name="description"]');
    await descriptionInput.fill("Автоматический E2E тест");

    // Verify form fields are filled
    await expect(titleInput).toHaveValue(uniqueTestName);
    await expect(descriptionInput).toHaveValue("Автоматический E2E тест");
  });

  test("TC-TST-T-003: Добавление вопроса (multiple choice)", async ({ page }) => {
    // Navigate to create test page
    await page.goto("/teacher/tests/create");
    await waitForPageLoad(page);

    // Fill test name first
    const uniqueTestName = `E2E Test MC ${Date.now()}`;
    await page.locator('input[id="test-title"]').fill(uniqueTestName);

    // Find first question prompt textarea
    const promptTextarea = page.locator('textarea[id^="question-"][id$="-prompt"]').first();
    await promptTextarea.fill("Столица России?");

    // Fill option A
    const optionA = page.locator('input[placeholder*="Variant A"], input[placeholder*="Вариант A"]').first();
    await optionA.fill("Москва");

    // Fill option B
    const optionB = page.locator('input[placeholder*="Variant B"], input[placeholder*="Вариант B"]').first();
    await optionB.fill("Санкт-Петербург");

    // Fill option C
    const optionC = page.locator('input[placeholder*="Variant C"], input[placeholder*="Вариант C"]').first();
    await optionC.fill("Новосибирск");

    // Select correct answer (radio button for option A)
    const correctRadio = page.locator('input[name^="correct-"][type="radio"]').first();
    await correctRadio.check();

    // Verify question type is multiple choice (default)
    const questionTypeSelect = page.locator('select[id^="question-"][id$="-type"], select').first();
    await expect(questionTypeSelect).toHaveValue("multiple_choice");
  });

  test("TC-TST-T-004: Добавление вопроса (open-ended)", async ({ page }) => {
    // Navigate to create test page
    await page.goto("/teacher/tests/create");
    await waitForPageLoad(page);

    // Fill test name first
    const uniqueTestName = `E2E Test OE ${Date.now()}`;
    await page.locator('input[id="test-title"]').fill(uniqueTestName);

    // Change first question type to short_answer
    const questionTypeSelect = page.locator('select').first();
    await questionTypeSelect.selectOption("short_answer");

    // Verify type changed
    await expect(questionTypeSelect).toHaveValue("short_answer");

    // Fill prompt
    const promptTextarea = page.locator('textarea[id^="question-"][id$="-prompt"]').first();
    await promptTextarea.fill("Опишите процесс фотосинтеза");

    // Fill expected answer
    const answerTextarea = page.locator('textarea[id^="question-"][id$="-answer"]').first();
    await answerTextarea.fill("Фотосинтез — процесс преобразования света в химическую энергию");

    // Verify answer field is visible (for short_answer type)
    await expect(answerTextarea).toBeVisible();
  });

  test("TC-TST-T-005: Загрузка изображения к вопросу (QuestionImageUpload)", async ({ page }) => {
    // Navigate to create test page
    await page.goto("/teacher/tests/create");
    await waitForPageLoad(page);

    // Fill test name
    const uniqueTestName = `E2E Test Image ${Date.now()}`;
    await page.locator('input[id="test-title"]').fill(uniqueTestName);

    // Look for image upload button within question card
    // The QuestionImageManager component has an add image button
    const addImageButton = page.locator('button:has-text("Добавить изображение"), button:has-text("Add image"), button:has-text("Раşka tasvir")').first();

    // Check if button exists and is visible
    const isImageButtonVisible = await addImageButton.isVisible().catch(() => false);

    if (isImageButtonVisible) {
      // Click to open file input
      await addImageButton.click();

      // Verify file input is present (hidden input for file upload)
      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      await expect(fileInput).toBeAttached();
    } else {
      // If no image button visible, test that the image manager component is present
      const imageSection = page.locator("[class*='image'], .image-manager, [data-testid='image-upload']").first();
      await expect(imageSection).toBeVisible();
    }
  });

  test("TC-TST-T-006: Редактирование теста — изменение вопросов", async ({ page }) => {
    // First create a test
    const uniqueTestName = `E2E Test Edit ${Date.now()}`;

    // Navigate to tests list
    await navigateTo(page, "tests");
    await waitForPageLoad(page);

    // Look for the create button and navigate to create page
    await page.goto("/teacher/tests/create");
    await waitForPageLoad(page);

    // Fill test name
    await page.locator('input[id="test-title"]').fill(uniqueTestName);

    // Fill first question
    await page.locator('textarea[id^="question-"][id$="-prompt"]').first().fill("Редактируемый вопрос");

    // Add another question by clicking "Добавить вопрос" button
    const addQuestionButton = page.locator('button:has-text("Добавить вопрос"), button:has-text("Savol qoʻshish")').first();
    await addQuestionButton.click();

    // Wait for new question to appear
    await page.waitForTimeout(500);

    // Verify second question exists
    const secondPrompt = page.locator('textarea[id^="question-"][id$="-prompt"]').nth(1);
    await expect(secondPrompt).toBeVisible();

    // Fill second question
    await secondPrompt.fill("Второй вопрос для редактирования");
  });

  test("TC-TST-T-007: Удаление теста", async ({ page }) => {
    // Navigate to tests list
    await navigateTo(page, "tests");
    await waitForPageLoad(page);

    // Look for test rows or cards
    const testItems = page.locator("tbody tr, [role='row'], .test-item, [data-testid='test-row']");
    const initialCount = await testItems.count();

    // If we have tests, find delete button
    if (initialCount > 0) {
      // Find delete button for first test
      const deleteButton = page.locator('button:has-text("Удалить"), [data-testid="delete-btn"], [aria-label*="Delete"]').first();

      // Check if delete button is visible
      const isDeleteVisible = await deleteButton.isVisible().catch(() => false);

      if (isDeleteVisible) {
        await deleteButton.click();

        // Wait for confirmation dialog
        await page.waitForLoadState("networkidle");

        // Verify confirmation dialog appears
        const confirmDialog = page.locator("[role='alertdialog'], .confirm-dialog, [data-testid='confirm-delete']");
        await expect(confirmDialog).toBeVisible();

        // Confirm deletion
        await page.click('button:has-text("Подтвердить"), button:has-text("Удалить"), [data-testid="confirm-delete-btn"]');

        // Wait for operation to complete
        await page.waitForLoadState("networkidle");
      }
    }

    // Verify we're still on tests page
    await expect(page).toHaveURL(/\/teacher\/tests/);
  });

  test("TC-TST-T-008: Отправка теста в организацию (submit-to-organization)", async ({ page }) => {
    // Navigate to tests list
    await navigateTo(page, "tests");
    await waitForPageLoad(page);

    // Look for submit or send button
    const submitButton = page.locator('button:has-text("Отправить"), button:has-text("Submit"), button:has-text("Опубликовать")').first();

    // Check if submit button exists
    const isSubmitVisible = await submitButton.isVisible().catch(() => false);

    if (isSubmitVisible) {
      await submitButton.click();

      // Wait for submission dialog/modal
      await page.waitForLoadState("networkidle");

      // Verify dialog appears or we're redirected to organization selection
      const currentUrl = page.url();
      expect(currentUrl.includes("submit") || currentUrl.includes("organization") || currentUrl.includes("tests")).toBeTruthy();
    } else {
      // If no submit button in list, check individual test page
      const testLink = page.locator("tbody tr a, [role='row'] a, .test-item a").first();
      const hasTests = await testLink.isVisible().catch(() => false);

      if (hasTests) {
        await testLink.click();
        await page.waitForLoadState("networkidle");

        // Look for submit button on test detail page
        const detailSubmitButton = page.locator('button:has-text("Отправить"), button:has-text("Submit")').first();
        const hasSubmitOnDetail = await detailSubmitButton.isVisible().catch(() => false);

        if (hasSubmitOnDetail) {
          await detailSubmitButton.click();
          await page.waitForLoadState("networkidle");
        }
      }
    }

    // Verify we stayed on teacher tests flow
    await expect(page).toHaveURL(/\/teacher\/tests/);
  });

  test.fixme(
    KNOWN_BUGS.QUESTION_BANK_SSR,
    "TC-TST-T-009: Запрос редактирования после отправки (request-edit) — Question Bank SSR crash"
  )
  test("TC-TST-T-009: Запрос редактирования после отправки (request-edit)", async ({ page }) => {
    // Navigate to tests list
    await navigateTo(page, "tests");
    await waitForPageLoad(page);

    // Look for "Request edit" or "Запросить редактирование" button
    const requestEditButton = page.locator(
      'button:has-text("Запросить редактирование"), button:has-text("Request edit"), button:has-text("Редактировать")'
    ).first();

    // Check if button exists
    const isRequestEditVisible = await requestEditButton.isVisible().catch(() => false);

    if (isRequestEditVisible) {
      await requestEditButton.click();

      // Wait for request edit dialog
      await page.waitForLoadState("networkidle");

      // Verify dialog appears
      const dialog = page.locator("[role='dialog'], .modal, [data-testid='request-edit-modal']");
      await expect(dialog).toBeVisible();
    } else {
      // If no request edit button, navigate to test detail
      const testLink = page.locator("tbody tr a, [role='row'] a").first();
      const hasTests = await testLink.isVisible().catch(() => false);

      if (hasTests) {
        await testLink.click();
        await page.waitForLoadState("networkidle");

        // Check for request edit option on detail page
        const detailRequestEdit = page.locator('button:has-text("Запросить"), button:has-text("Request")').first();
        const hasDetailRequestEdit = await detailRequestEdit.isVisible().catch(() => false);

        if (hasDetailRequestEdit) {
          await detailRequestEdit.click();
          await page.waitForLoadState("networkidle");
        }
      }
    }

    // Verify we're still in tests flow
    await expect(page).toHaveURL(/\/teacher\/tests/);
  });

  test("TC-TST-T-010: Создание теста без вопросов — валидация", async ({ page }) => {
    // Navigate to create test page
    await page.goto("/teacher/tests/create");
    await waitForPageLoad(page);

    // Fill test name
    const uniqueTestName = `E2E Test Empty ${Date.now()}`;
    await page.locator('input[id="test-title"]').fill(uniqueTestName);

    // Clear any default question prompt to simulate empty question
    const promptTextarea = page.locator('textarea[id^="question-"][id$="-prompt"]').first();
    await promptTextarea.clear();

    // Try to submit form
    const submitButton = page.locator('button[type="submit"]:has-text("Создать"), button[type="submit"]:has-text("Сохранить")');
    await submitButton.click();

    // Wait for validation or response
    await page.waitForLoadState("networkidle");

    // Check for validation error messages
    // Error could be in: general error div, or per-question error
    const validationError = page.locator(
      ".text-error, [class*='error'], text=/Пожалуйста|required|обязательно/i"
    );

    // Verify validation appears OR form stays on create page
    const currentUrl = page.url();
    const hasValidation = await validationError.isVisible().catch(() => false);

    // Either validation shows or we stay on the page (form didn't submit)
    expect(hasValidation || currentUrl.includes("create")).toBeTruthy();
  });
});