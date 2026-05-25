import { test, expect } from "@playwright/test";
import { loginAsStudent, loginAsTeacher, loginAsAdmin, logout, isAuthenticated } from "./helpers/auth";
import { navigateToDashboard, waitForPageReady } from "./helpers/navigation";

// Skip all tests when running under Bun (Playwright requires Node.js)
const isBun = typeof (process as { versions?: { bun?: string } }).versions?.bun !== "undefined";

test.describe("Smoke Tests - Role Dashboards", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (isBun) {
      testInfo.skip();
    }
  });

  test("student dashboard loads after login", async ({ page }) => {
    await loginAsStudent(page);
    
    // Verify we're on the student dashboard
    await expect(page).toHaveURL("/student");
    
    // Verify page loaded successfully
    await waitForPageReady(page);
    
    // Verify user is authenticated
    expect(await isAuthenticated(page)).toBe(true);
    
    // Verify page has content (body is visible)
    await expect(page.locator("body")).toBeVisible();
    
    // Clean up
    await logout(page);
  });

  test("teacher dashboard loads after login", async ({ page }) => {
    await loginAsTeacher(page);
    
    // Verify we're on the teacher dashboard
    await expect(page).toHaveURL("/teacher");
    
    // Verify page loaded successfully
    await waitForPageReady(page);
    
    // Verify user is authenticated
    expect(await isAuthenticated(page)).toBe(true);
    
    // Verify page has content
    await expect(page.locator("body")).toBeVisible();
    
    // Clean up
    await logout(page);
  });

  test("admin dashboard loads after login", async ({ page }) => {
    await loginAsAdmin(page);
    
    // Verify we're on the admin dashboard
    await expect(page).toHaveURL("/admin");
    
    // Verify page loaded successfully
    await waitForPageReady(page);
    
    // Verify user is authenticated
    expect(await isAuthenticated(page)).toBe(true);
    
    // Verify page has content
    await expect(page.locator("body")).toBeVisible();
    
    // Clean up
    await logout(page);
  });

  test("unauthenticated user is redirected from protected routes", async ({ page }) => {
    // Try to access student dashboard without login
    await navigateToDashboard(page, "student");
    
    // Should be redirected to login page
    await expect(page).toHaveURL(/\/auth\/student\/login/);
  });

  test("public homepage loads without authentication", async ({ page }) => {
    await page.goto("/");
    
    await waitForPageReady(page);
    
    // Verify page loaded
    await expect(page.locator("body")).toBeVisible();
  });
});
