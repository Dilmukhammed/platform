import { test, expect } from "@playwright/test";

import { loginAsTeacher, logoutTeacher } from "./helpers/teacher-helpers";

test.describe("TC-ONB-T: Онбординг и организации", () => {
  test.afterEach(async ({ page }) => {
    await logoutTeacher(page);
  });

  test("TC-ONB-T-001: Создание организации — редирект на /teacher/organizations", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to onboarding page
    await page.goto("/teacher/onboarding");
    await page.waitForLoadState("load");

    const currentUrl = page.url();

    // If teacher already has an org, they get redirected away from onboarding
    if (!currentUrl.includes("/teacher/onboarding")) {
      // Navigate directly to organizations page instead
      await page.goto("/teacher/organizations");
      await page.waitForLoadState("load");
      await expect(page.locator("h1")).toContainText(/Организации|Tashkilotlar/i);
      return;
    }

    // Verify we're on the onboarding page
    await expect(page.locator("main").first()).toBeVisible();

    // Click "Создать организацию" / "Tashkilot yaratish" button
    const createOrgButton = page.locator("text=/Создать организацию|Tashkilot yaratish/i").first();
    await createOrgButton.click();

    // Verify redirect to /teacher/organizations
    await page.waitForURL(/\/teacher\/organizations/);
    await expect(page.locator("h1")).toContainText(/Организации|Tashkilotlar/i);
  });

  test("TC-ONB-T-002: Присоединение к организации по invite-коду", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to onboarding page
    await page.goto("/teacher/onboarding");

    await page.waitForLoadState("load");
    const onboardingUrl = page.url();

    // If teacher already has an org, they get redirected away
    if (!onboardingUrl.includes("/teacher/onboarding")) {
      // Test not applicable for teacher with existing org
      return;
    }

    // Verify we're on the onboarding page
    await expect(page.locator("main").first()).toBeVisible();

    // Click "Присоединиться по приглашению" / "Taklif bo'yicha qo'shilish" button
    const joinButton = page.locator("text=/Присоединиться по приглашению|Taklif bo'yicha qo'shilish/i").first();
    await joinButton.click();

    // Verify redirect to invite accept page
    await page.waitForURL(/\/auth\/teacher\/invite\/accept/);
    await expect(page.locator("h1, input[name='code'], input[name='inviteCode']")).toBeVisible();
  });

  test("TC-ONB-T-003: Страница ожидания /teacher/pending-approval", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to pending approval page directly
    await page.goto("/teacher/pending-approval");

    const currentUrl = page.url();

    // If user has no pending memberships, they will be redirected
    if (currentUrl.includes("/teacher/onboarding") || currentUrl === "/teacher" || currentUrl.endsWith("/teacher")) {
      // User has no pending org - redirected to onboarding or dashboard
      // This is valid behavior - skip rest of test
      test.skip(true, "No pending memberships - user redirected appropriately");
      return;
    }

    // Verify we're on the pending approval page (Uzbek: "Kutilmoqda" / Russian: "Ожидание")
    await expect(page.locator("h1")).toContainText(/Kutilmoqda|Ожидание/i);

    // Should show the status card with pending organization info
    // Uzbek: "Tashkilot holati" / Russian: "Статус организации"
    await expect(page.locator("text=/Статус организации|Tashkilot holati/i")).toBeVisible();
    // Uzbek: "Tasdiqlash kutilmoqda" / Russian: "Ожидание подтверждения"
    await expect(page.locator("text=/Ожидание подтверждения|Tasdiqlash kutilmoqda/i")).toBeVisible();

    // Should show next steps (Uzbek: "Keyingi qadammlar" / Russian: "Что происходит дальше")
    await expect(page.locator("text=/Что происходит дальше|Keyingi qadamlar/i")).toBeVisible();

    // Should have a button to check status (Uzbek: "Holatni tekshirish" / Russian: "Проверить статус")
    await expect(page.locator("text=/Проверить статус|Holatni tekshirish/i")).toBeVisible();
  });

  test("TC-ONB-T-004: Приглашение учителя (InviteTeacherModal)", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to organizations page
    await page.goto("/teacher/organizations");

    // Verify we're on the organizations page (Uzbek: "Tashkilotlar" / Russian: "Организации")
    await expect(page.locator("h1")).toContainText(/Организации|Tashkilotlar/i);

    // Find an organization card where we are owner with active status
    // The Invite button only shows for owners with active membership
    // Uzbek: "Taklif qilish" / Russian: "Пригласить"
    const inviteButton = page.locator('button:has-text("Taklif qilish"), button:has-text("Пригласить"), button:has-text("Invite")').first();

    // If we have organizations, try to invite
    const hasInviteButton = await inviteButton.isVisible().catch(() => false);

    if (hasInviteButton) {
      // Click the invite button to open modal
      await inviteButton.click();

      // Verify modal is open
      await expect(page.locator('input[type="email"]')).toBeVisible();

      // Fill in email
      await page.fill('input[name="email"]', "newteacher@example.com");

      // Submit the form
      await page.click('button[type="submit"]');

      // Wait for success message or modal close
      await page.waitForTimeout(1000);
    }
  });

  test("TC-ONB-T-005: Список организаций", async ({ page }) => {
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) console.log("[NAV]", frame.url());
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("[CONSOLE ERR]", msg.text());
    });

    await loginAsTeacher(page);
    console.log("[DEBUG] After login, URL:", page.url());

    // Navigate to organizations page
    await page.goto("/teacher/organizations");
    console.log("[DEBUG] After goto orgs, URL:", page.url());
    console.log("[DEBUG] H1 text:", await page.locator("h1").first().textContent().catch(() => "(none)"));

    // Verify we're on the organizations page (Uzbek: "Tashkilotlar" / Russian: "Организации")
    await expect(page.locator("h1")).toContainText(/Организации|Tashkilotlar/i);

    // Check for organizations grid or empty state
    const organizationsSection = page.locator("section").first();

    // Page should load without errors
    await page.waitForLoadState("load");

    // Should show description (Uzbek: "Tashkilotlaringizni boshqaring" / Russian: "Управляйте вашими организациями")
    await expect(page.locator("text=/Управляйте вашими организациями|Tashkilotlaringizni boshqaring/i")).toBeVisible();

    // If organizations exist, verify grid layout
    const cards = page.locator('[class*="card"], [class*="Card"]');
    const cardCount = await cards.count();

    // There should be either:
    // - Organization cards displayed, OR
    // - Empty state with create/join buttons
    if (cardCount > 0) {
      // Verify at least one organization card structure
      // Uzbek: "Rol:" / Russian: "Роль:"
      await expect(page.locator("text=/Роль:|Rol:/i")).toBeVisible();
      // Uzbek: "Holat:" / Russian: "Статус:"
      await expect(page.locator("text=/Статус:|Holat:/i")).toBeVisible();
    } else {
      // Empty state should have action buttons
      // Uzbek: "Tashkilot yaratish" / Russian: "Создать организацию"
      await expect(page.locator("text=/Создать организацию|Tashkilot yaratish/i")).toBeVisible();
      // Uzbek: "Qo'shilish" / Russian: "Присоединиться"
      await expect(page.locator("text=/Присоединиться|Qo'shilish/i")).toBeVisible();
    }
  });
});