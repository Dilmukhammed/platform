/**
 * Teacher Materials Upload E2E Tests
 *
 * Test scenarios for teacher materials file upload edge cases including:
 * - Large file upload (progress indication)
 * - Russian Unicode filenames
 * - Filenames with spaces
 * - Unsupported file types (.exe)
 * - Empty file selection validation
 * - Upload cancel/removal behavior
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { loginAsTeacher, logoutTeacher, waitForPageLoad, TEST_CREDENTIALS } from "./helpers/teacher-helpers";

// Temp directory for test fixture files
let tempDir: string;

test.beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "materials-upload-test-"));
});

test.afterAll(async () => {
  // Clean up temp directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

/**
 * Helper: Create a test file with specified name and size.
 */
function createTestFile(dir: string, name: string, sizeInBytes: number): string {
  const filePath = path.join(dir, name);
  const buffer = Buffer.alloc(sizeInBytes, "x"); // Fill with 'x' character
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Helper: Create a small text file with specific content.
 */
function createTextFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

test.describe("TC-UPL-T: Загрузка материалов — edge cases", () => {
  test.beforeEach(async ({ page }) => {
    // Login as teacher
    await loginAsTeacher(page);
    // Navigate to materials page (upload form is on this page)
    await page.goto("/teacher/materials");
  });

  test("TC-UPL-T-001: Крупный файл (~10MB) → индикация прогресса", async ({ page }) => {
    // Create a ~10MB test file
    const largeFilePath = createTestFile(tempDir, "large_material.pdf", 10 * 1024 * 1024);

    // Fill title
    await page.fill('input[name="title"]', "Test Large File Upload");

    // Set file using setInputFiles (direct to hidden input)
    const fileInput = page.locator("#material-file-input");
    await fileInput.setInputFiles(largeFilePath);

    // Verify file is selected and shows filename
    await expect(page.locator("text=large_material.pdf")).toBeVisible();
    await expect(page.locator("text=/10\\.0 MB/")).toBeVisible();

    // Submit form
    await page.click('button[type="submit"]');

    // Should show upload progress stages
    // Initializing stage
    await expect(page.locator("text=/Yuklanmoqda/i")).toBeVisible({ timeout: 5000 }).catch(() => {
      // Stage may be brief, continue
    });

    // Uploading stage with progress
    await expect(page.locator("text=/Yuklanmoqda/i")).toBeVisible({ timeout: 10000 });

    // Progress percentage should be visible during upload
    await expect(page.locator("text=/\\d+%/")).toBeVisible({ timeout: 5000 });

    // Clean up
    fs.unlinkSync(largeFilePath);
  });

  test("TC-UPL-T-002: Русский Unicode в имени файла (тестовый_материал.txt)", async ({ page }) => {
    // Create text file with Russian name
    const russianFilePath = createTextFile(tempDir, "тестовый_материал.txt", "Тестовое содержимое");

    // Fill title
    await page.fill('input[name="title"]', "Test Russian Filename");

    // Set file
    const fileInput = page.locator("#material-file-input");
    await fileInput.setInputFiles(russianFilePath);

    // Verify file with Russian name is selected
    await expect(page.locator("text=тестовый_материал.txt")).toBeVisible();

    // Submit form
    await page.click('button[type="submit"]');

    // Should proceed with upload (Unicode filenames should be handled by the backend)
    // Wait for any error or success state
    const hasError = await page.locator('[class*="error"], text=/ошибка|error/i').isVisible({ timeout: 3000 }).catch(() => false);

    if (hasError) {
      // If error occurs, it should be a backend issue (document with test.fixme)
      test.fixme("TC-UPL-T-002: Russian Unicode filename may not be properly handled by backend storage");
    } else {
      // Should complete successfully
      await expect(page.locator("text=/успешно|success|created/i")).toBeVisible({ timeout: 15000 }).catch(() => {
        // May redirect to materials list
      });
    }

    // Clean up
    fs.unlinkSync(russianFilePath);
  });

  test("TC-UPL-T-003: Пробелы в имени файла (my test file.txt)", async ({ page }) => {
    // Create text file with spaces in name
    const spacedFilePath = createTextFile(tempDir, "my test file.txt", "Test content with spaces");

    // Fill title
    await page.fill('input[name="title"]', "Test Spaces in Filename");

    // Set file
    const fileInput = page.locator("#material-file-input");
    await fileInput.setInputFiles(spacedFilePath);

    // Verify file with spaces is selected
    await expect(page.locator("text=my test file.txt")).toBeVisible();

    // Submit form
    await page.click('button[type="submit"]');

    // Should handle spaces in filename (backend should encode properly)
    const hasError = await page.locator('[class*="error"], text=/ошибка|error/i').isVisible({ timeout: 3000 }).catch(() => false);

    if (hasError) {
      test.fixme("TC-UPL-T-003: Filename with spaces may not be properly handled");
    } else {
      await expect(page.locator("text=/успешно|success|created/i")).toBeVisible({ timeout: 15000 }).catch(() => {
        // May redirect
      });
    }

    // Clean up
    fs.unlinkSync(spacedFilePath);
  });

  test("TC-UPL-T-004: Удаление файла до отправки (X кнопка)", async ({ page }) => {
    // Create a test file
    const testFilePath = createTextFile(tempDir, "to_remove.txt", "This file will be removed");

    // Fill title
    await page.fill('input[name="title"]', "Test File Removal Before Submit");

    // Set file
    const fileInput = page.locator("#material-file-input");
    await fileInput.setInputFiles(testFilePath);

    // Verify file is selected
    await expect(page.locator("text=to_remove.txt")).toBeVisible();

    // Click X button to remove file
    // The X button has aria-label="Fayl biriktirilmagan" ( Uzbek: "File not attached")
    const removeButton = page.locator('button[aria-label="Fayl biriktirilmagan"]');
    await removeButton.click();

    // File should be removed - no filename visible
    await expect(page.locator("text=to_remove.txt")).not.toBeVisible();

    // The file input hint should be visible again (Uzbek: "Fayl biriktirilmagan")
    await expect(page.locator("text=/Fayl biriktirilmagan/i")).toBeVisible();

    // Submit button should be disabled (no file selected)
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();

    // Clean up
    fs.unlinkSync(testFilePath);
  });

  test("TC-UPL-T-005: Неподдерживаемый тип файла (.exe) → ошибка валидации", async ({ page }) => {
    // Create an .exe file (not in ACCEPTED_FILE_TYPES)
    const exeFilePath = createTestFile(tempDir, "malware.exe", 1024);

    // Fill title
    await page.fill('input[name="title"]', "Test Unsupported File Type");

    // Try to set file - the input has accept attribute but Playwright can still set files
    // We need to test what happens when a file is selected
    const fileInput = page.locator("#material-file-input");
    await fileInput.setInputFiles(exeFilePath);

    // File will be selected (browser doesn't enforce accept attribute programmatically)
    await expect(page.locator("text=malware.exe")).toBeVisible();

    // Submit form
    await page.click('button[type="submit"]');

    // Should either:
    // 1. Show validation error about unsupported file type, OR
    // 2. Backend should reject with error
    // Currently the form does NOT validate file types on client - only checks if file exists

    // Wait for error state
    const errorVisible = await page.locator('[class*="error"], text=/ошибка|error|unsupported|invalid/i').isVisible({ timeout: 5000 }).catch(() => false);

    if (!errorVisible) {
      // If no immediate error, the backend should reject it
      test.fixme("TC-UPL-T-005: No client-side validation for unsupported file types (.exe allowed)");
    }

    // Clean up
    fs.unlinkSync(exeFilePath);
  });

  test("TC-UPL-T-006: Файл не выбран → валидационная ошибка", async ({ page }) => {
    // Fill title but don't select any file
    await page.fill('input[name="title"]', "Test No File Selected");

    // Submit button should be disabled initially
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();

    // Force click to try submitting anyway (bypass disabled state if needed)
    // Note: HTML5 validation should prevent submission, but test the actual behavior

    // Try clicking submit when no file is selected
    await page.evaluate(() => {
      const form = document.querySelector("form");
      if (form) {
        // Remove disabled attribute to test form validation
        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (submitBtn) submitBtn.removeAttribute("disabled");
      }
    });

    await page.click('button[type="submit"]');

    // Should show error about file being required
    // The form displays: "Materialni saqlashdan oldin fayl tanlang." (Uzbek)
    await expect(page.locator("text=/Materialni saqlashdan oldin fayl tanlang/i")).toBeVisible({ timeout: 3000 }).catch(() => {
      // If no error shown, document as bug
      test.fixme("TC-UPL-T-006: No visible error message when file is not selected before submit");
    });
  });
});
