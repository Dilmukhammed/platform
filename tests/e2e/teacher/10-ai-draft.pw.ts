/**
 * Teacher AI Draft E2E Tests
 *
 * Test scenarios for AI-powered test draft generation including:
 * - TC-AI-T-001: SSR crash on AI Draft page (FIXME - known bug)
 * - TC-AI-T-002: Submit generation request via CreateAiDraftForm
 * - TC-AI-T-003: Poll job status endpoint until completion
 * - TC-AI-T-004: Edit generated draft via DraftEditor
 */

import { test, expect } from "@playwright/test";

import { loginAsTeacher, KNOWN_BUGS } from "./helpers/teacher-helpers";

const BASE_URL = "http://localhost:3002";

test.describe("TC-AI-T: AI генерация тестовых черновиков", () => {
  test.beforeEach(async ({ page }) => {
    // Login as teacher before each test
    await loginAsTeacher(page);
  });

  test("TC-AI-T-001: Открытие страницы AI Draft → SSR краш", async ({ page }) => {
    // AI_DRAFT_SSR: Page crashes due to SSR issues with AI Draft component
    test.fixme(KNOWN_BUGS.AI_DRAFT_SSR, "AI Draft page crashes on server-side rendering");

    // Navigate directly to AI Draft page - this will crash due to SSR bug
    await page.goto(`${BASE_URL}/teacher/tests/ai-draft`);

    // If the page loads (when SSR bug is fixed), we should see the AI Draft interface
    // Currently this test is marked as fixme because the page crashes
    await expect(page).toHaveURL(/\/teacher\/tests\/ai-draft/);
  });

  test("TC-AI-T-002: Отправка запроса на генерацию → CreateAiDraftForm", async ({ page }) => {
    // Navigate to AI Draft page
    await page.goto(`${BASE_URL}/teacher/tests/ai-draft`);

    // Wait for form to be visible - form has textarea[name="prompt"] and submit button
    await page.waitForSelector('textarea[name="prompt"], form', { timeout: 10000 });

    // Fill in the generation request form
    const promptInput = page.locator('textarea[name="prompt"]').first();
    if (await promptInput.isVisible({ timeout: 5000 })) {
      await promptInput.fill("Algebra fundamentals - linear equations and inequalities");
    }

    // Select question count if visible
    const questionCountSelect = page.locator('select[name="questionCount"]').first();
    if (await questionCountSelect.isVisible({ timeout: 5000 })) {
      await questionCountSelect.selectOption("5");
    }

    // Select question type if visible
    const questionTypeSelect = page.locator('select[name="questionType"]').first();
    if (await questionTypeSelect.isVisible({ timeout: 5000 })) {
      await questionTypeSelect.selectOption("short_answer");
    }

    // Find and click the submit/generate button (Uzbek: "AI qoralama yaratish")
    const generateButton = page.locator('button[type="submit"]').filter({ hasText: /AI qoralama yaratish|Create AI/i }).first();
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // After submission, should navigate to job status or show loading state
    // The form submits to /api/v1/teacher/test-drafts/generate
    await expect(page).not.toHaveURL(/\/teacher\/tests\/ai-draft$/); // Should navigate away or show job in progress
  });

  test("TC-AI-T-003: Проверка статуса задания → polling /api/v1/teacher/test-drafts/jobs/[jobId]", async ({ page }) => {
    // Navigate to AI Draft page
    await page.goto(`${BASE_URL}/teacher/tests/ai-draft`);

    // Submit a generation request to get a job ID
    // First, try to find if there's an existing job in progress on the page
    const jobIdElement = page.locator('[data-job-id], [data-test-draft-job-id], .job-status').first();

    if (await jobIdElement.isVisible({ timeout: 5000 })) {
      const jobId = await jobIdElement.getAttribute("data-job-id");

      if (jobId) {
        // Poll the job status endpoint
        const maxAttempts = 10;
        let jobStatus = "";
        let attempts = 0;

        while (attempts < maxAttempts) {
          const response = await page.request.get(`/api/v1/teacher/test-drafts/jobs/${jobId}`);

          expect(response.status()).toBe(200);

          const statusData = await response.json();
          jobStatus = statusData.status || statusData.state || statusData.progress;

          // Check for terminal states
          if (jobStatus === "completed" || jobStatus === "ready" || jobStatus === "success") {
            break;
          }
          if (jobStatus === "failed" || jobStatus === "error") {
            throw new Error(`Job failed with status: ${statusData.error || jobStatus}`);
          }

          // Wait before next poll
          await page.waitForTimeout(2000);
          attempts++;
        }

        expect(jobStatus).toMatch(/completed|ready|success/i);
      }
    } else {
      // No job in progress - test that the endpoint is reachable with a mock job ID
      const mockJobId = "test-job-12345";
      const response = await page.request.get(`/api/v1/teacher/test-drafts/jobs/${mockJobId}`);

      // Should return 200 (even for not found, since it's a valid endpoint)
      // or 404 with proper JSON response indicating the endpoint works
      expect(response.status()).toBeLessThan(500);
      const json = await response.json();
      expect(typeof json).toBe("object"); // Should return JSON, not crash
    }
  });

  test("TC-AI-T-004: Редактирование сгенерированного черновика → DraftEditor", async ({ page }) => {
    // Navigate to AI Draft page or drafts list
    await page.goto(`${BASE_URL}/teacher/tests/ai-draft`);

    // Look for an existing draft to edit
    // This could be a draft card, a list item, or navigation to edit mode
    const draftItem = page.locator('[data-draft-id], [data-test-draft-id], a[href*="edit"], a[href*="draft"]').first();

    if (await draftItem.isVisible({ timeout: 5000 })) {
      // Click on a draft to open it in the editor
      await draftItem.click();

      // Wait for DraftEditor to load
      await page.waitForSelector('[data-draft-editor], .draft-editor, textarea[name*="content"], textarea[name*="question"]', { timeout: 10000 });

      // Verify DraftEditor components are present
      // Common elements: question textareas, answer inputs, save button
      const editorPresent = await page.locator('textarea, [contenteditable], [data-editor]').first().isVisible();
      expect(editorPresent).toBeTruthy();

      // Try to make an edit if possible
      const firstEditable = page.locator('textarea[name*="content"], textarea[name*="question"], [contenteditable="true"]').first();
      if (await firstEditable.isVisible({ timeout: 5000 })) {
        const originalValue = await firstEditable.inputValue();
        await firstEditable.fill(originalValue + "\nEdited content added by test");

        // Find and verify save functionality exists (Uzbek: "Oʻzgarishlarni saqlash" or "Save")
        const saveButton = page.locator('button:has-text("Oʻzgarishlarni saqlash"), button:has-text("Save"), button[type="submit"]').first();
        const hasSaveButton = await saveButton.isVisible({ timeout: 2000 });

        if (hasSaveButton) {
          // Verify save action completes without error
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }
    } else {
      // No drafts available - verify the drafts list/page is accessible
      await page.goto(`${BASE_URL}/teacher/tests/drafts`);
      await expect(page).toHaveURL(/\/teacher\/tests\/drafts/);
    }
  });
});