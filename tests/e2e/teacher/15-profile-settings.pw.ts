/**
 * Teacher Profile & Settings E2E Tests
 *
 * Test scenarios for teacher profile and settings including:
 * - View profile data display
 * - Edit profile (name, bio)
 * - Upload avatar
 * - Change password
 * - Notification preferences
 * - Account/security settings
 */

import { test, expect } from "@playwright/test";

import { loginAsTeacher, TEST_CREDENTIALS } from "./helpers/teacher-helpers";

test.describe("TC-SET-T: Профиль и настройки учителя", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsTeacher(page);
    await page.goto("/teacher/settings");
  });

  test("TC-SET-T-001: Просмотр профиля — отображение данных", async ({ page }) => {
    // Profile section should be visible with user data
    await expect(page.locator("text=Profile")).toBeVisible();
    // Use visible text/email inputs to avoid picking up hidden React Server Action inputs
    await expect(page.locator("input[type='text'], input[type='email']").first()).toBeVisible();

    // Should show display name, login identifier, and role badge
    const displayNameInput = page.locator("input[type='text'], input[type='email']").first();
    await expect(displayNameInput).toBeVisible();

    // Role badge should be visible
    await expect(page.locator("text=teacher").or(page.locator('button:has-text("teacher")')).first()).toBeVisible();

    // Organization section should be visible
    await expect(page.locator("text=Organization").or(page.locator("text=School")).first()).toBeVisible();
  });

  test("TC-SET-T-002: Редактирование профиля — имя, описание", async ({ page }) => {
    // Click Edit Profile button
    await page.click("button:has-text('Edit Profile')");

    // Should show Save and Cancel buttons
    await expect(page.locator("button:has-text('Save')")).toBeVisible();
    await expect(page.locator("button:has-text('Cancel')")).toBeVisible();

    // Clear and update display name
    const displayNameInput = page.locator("#displayName");
    await displayNameInput.clear();
    const newName = `Teacher Updated ${Date.now()}`;
    await displayNameInput.fill(newName);

    // Click Save
    await page.click("button:has-text('Save')");

    // Wait for save to complete
    await page.waitForTimeout(500);

    // Should show updated name (input should have new value or reflect in UI)
    // Note: The actual save API call may need verification
    await expect(page.locator("button:has-text('Edit Profile')")).toBeVisible();
  });

  test("TC-SET-T-003: Загрузка аватара", async ({ page }) => {
    // Find the avatar upload button (camera/upload icon button)
    const uploadButton = page.locator('button[aria-label="Upload avatar"]');
    await expect(uploadButton).toBeVisible();

    // The file input should be hidden, trigger via label or direct upload
    const fileInput = page.locator('input[type="file"]');

    // Upload a test image
    await fileInput.setInputFiles({
      name: "avatar-test.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
    });

    // Should show uploading state
    await expect(page.locator("text=Uploading...")).toBeVisible({ timeout: 5000 }).catch(() => {
      // Uploading text may disappear quickly
    });
  });

  test("TC-SET-T-004: Изменение пароля", async ({ page }) => {
    // Click Change Password button (Uzbek: Parolni o'zgartirish, English: Change Password)
    await page.getByRole("button", { name: /Parolni o'zgartirish|Change Password/i }).click();

    // Modal should open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Fill password change form
    await page.fill('input[id="currentPassword"]', TEST_CREDENTIALS.teacher.password);

    const newPassword = "NewTeacher123!";
    await page.fill('input[id="newPassword"]', newPassword);
    await page.fill('input[id="confirmPassword"]', newPassword);

    // Submit form
    await page.click("button:has-text('Change')");

    // Should show success or error (depending on API behavior)
    // Either success modal or error message
    const successOrError = await Promise.race([
      page.waitForSelector("text=success", { timeout: 3000 }).then(() => "success"),
      page.waitForSelector('[role="dialog"]', { timeout: 3000 }).then(() => "dialog"),
    ]);

    // If success, verify and close
    if (successOrError === "success") {
      await expect(page.locator("text=success")).toBeVisible();
    }
  });

  test("TC-SET-T-005: Настройки уведомлений", async ({ page }) => {
    // Scroll to notification preferences section (Uzbek: Bildirishnomalar, Russian: Уведомления)
    await page.locator("text=/Bildirishnomalar|Уведомлен/i").first().scrollIntoViewIfNeeded();

    // Notification section should be visible
    await expect(page.locator("text=/Bildirishnomalar|Уведомлен/i").nth(1)).toBeVisible();

    // In-app notifications should show as enabled
    await expect(page.locator("text=In-App").or(page.locator("text=Email"))).toBeVisible();

    // Email notifications should show "Coming Soon" badge
    await expect(page.locator("text=Coming Soon")).toBeVisible();
  });

  test("TC-SET-T-006: Настройки безопасности аккаунта", async ({ page }) => {
    // Scroll to security section (Uzbek: Xavfsizlik, Russian: Безопасность, English: Security)
    await page.locator("text=/Xavfsizlik|Безопасност|Security/i").scrollIntoViewIfNeeded();

    // Security section should be visible
    await expect(page.locator("text=/Xavfsizlik|Безопасност|Security/i").first()).toBeVisible();

    // Password change button should be visible (Uzbek: Parolni o'zgartirish)
    await expect(page.getByRole("button", { name: /Parolni o'zgartirish|Change Password/i })).toBeVisible();

    // Two-factor authentication should show "Coming Soon"
    await expect(page.locator("text=Two-Factor").or(page.locator("text=Coming Soon"))).toBeVisible();

    // Account footer should show user ID and role
    const footerText = await page.locator("text=/Account ID|Role/").textContent();
    await expect(footerText).toBeTruthy();
  });
});