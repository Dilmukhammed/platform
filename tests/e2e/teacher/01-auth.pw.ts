/**
 * Teacher Authentication E2E Tests
 *
 * Test scenarios for teacher role authentication including:
 * - Successful login
 * - Invalid credentials handling
 * - Empty field validation (AUTH-04 bug)
 * - Rate limiting (MB-002 bug)
 * - Registration flow
 * - Logout redirect
 */

import { test, expect } from "@playwright/test";

import { loginAsTeacher, logoutTeacher, TEST_CREDENTIALS } from "./helpers/teacher-helpers";

test.describe("TC-AUTH-T: Аутентификация учителя", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure clean state before each test
    await page.goto("/auth/teacher/sign-in");
  });

  test("TC-AUTH-T-001: Успешный вход", async ({ page }) => {
    await loginAsTeacher(page);
    // After login, may redirect to /teacher or /teacher/organizations if no org
    await expect(page).toHaveURL(/\/teacher/);
  });

  test("TC-AUTH-T-002: Неверный пароль → ошибка", async ({ page }) => {
    await page.fill('input[name="email"]', TEST_CREDENTIALS.teacher.email);
    await page.fill('input[name="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Should stay on sign-in page with error
    await expect(page).toHaveURL(/\/auth\/teacher\/sign-in/);
    // Uzbek error message: "Noto'g'ri email yoki parol"
    await expect(page.locator("text=/Elektron pochta yoki parol noto/i")).toBeVisible();
  });

  test("TC-AUTH-T-003: Пустые поля → валидация", async ({ page }) => {
    // AUTH-04: No client-side validation for empty login fields
    test.fixme(true, "AUTH-04: No client-side validation for empty login fields");

    // Submit empty form - should show validation error but currently doesn't (AUTH-04 bug)
    await page.click('button[type="submit"]');

    // Currently no client-side validation, so form submits and shows server error
    // TODO: When AUTH-04 is fixed, change this to expect HTML5 validation or custom validation message
    await expect(page).toHaveURL(/\/auth\/teacher\/sign-in/);
  });

  test("TC-AUTH-T-004: Неверный email → ошибка", async ({ page }) => {
    await page.fill('input[name="email"]', "notanemail");
    await page.fill('input[name="password"]', TEST_CREDENTIALS.teacher.password);
    await page.click('button[type="submit"]');

    // HTML5 native validation prevents form submission for invalid email format.
    // Either we stay on sign-in page (validation blocked submit) OR server returns error.
    await expect(page).toHaveURL(/\/auth\/teacher\/sign-in/);

    // Verify either HTML5 validation blocked submit (input is invalid)
    // OR server returned an error
    const emailInput = page.locator('input[name="email"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid).catch(() => false);
    const url = page.url();
    const hasServerError = url.includes("error=");
    expect(isInvalid || hasServerError).toBeTruthy();
  });

  test("TC-AUTH-T-005: Выход → редирект на /auth/teacher/sign-in", async ({ page }) => {
    // First login
    await loginAsTeacher(page);
    // After login may be /teacher or /teacher/organizations
    await expect(page).toHaveURL(/\/teacher/);

    // Then logout
    await logoutTeacher(page);

    // Should redirect to sign-in page
    await expect(page).toHaveURL("/auth/teacher/sign-in");
  });

  test("TC-AUTH-T-006: Регистрация нового учителя → редирект на онбординг", async ({ page }) => {
    // AUTH-06: Sign-up requires Supabase Auth admin API which may not be available in dev/test env
    test.fixme(true, "AUTH-06: Sign-up depends on Supabase Auth admin API availability");

    // Navigate to sign-up page
    await page.goto("/auth/teacher/sign-up");

    // Fill registration form
    await page.fill('input[name="name"]', "Test Teacher");
    await page.fill('input[name="email"]', `newteacher_${Date.now()}@school.edu`);
    await page.fill('input[name="password"]', "NewTeacher123!");
    await page.fill('input[name="confirmPassword"]', "NewTeacher123!");
    await page.click('button[type="submit"]');

    // Should redirect to sign-in with success message
    await expect(page).toHaveURL(/\/auth\/teacher\/sign-in\?registered=true/);
    // Uzbek/Russian success message - flexible matching
    await expect(page.locator("text=/muvaffaqiyat|success|успешно|created/i")).toBeVisible();
  });

  test("TC-AUTH-T-007: Rate limiting → 5+ неудачных попыток, блокировка", async ({ page }) => {
    // MB-002: Rate limiting requires 15 minute wait to unlock
    test.fixme(true, "MB-002: Rate limiting requires 15 minute wait to unlock");

    const invalidPassword = "WrongPassword123!";
    const validEmail = TEST_CREDENTIALS.teacher.email;

    // Attempt 5 failed logins to trigger rate limit
    for (let i = 0; i < 5; i++) {
      await page.goto("/auth/teacher/sign-in");
      await page.fill('input[name="email"]', validEmail);
      await page.fill('input[name="password"]', invalidPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/auth\/teacher\/sign-in/);
    }

    // After 5 failed attempts, should be rate limited
    await page.goto("/auth/teacher/sign-in");
    await page.fill('input[name="email"]', validEmail);
    await page.fill('input[name="password"]', invalidPassword);
    await page.click('button[type="submit"]');

    // Should show rate limit error
    await expect(page).toHaveURL(/\/auth\/teacher\/sign-in/);
    await expect(page.locator("text=/Too many login attempts|rate limit|blocked/i")).toBeVisible();
  });
});