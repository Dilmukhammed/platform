import type { Page } from "@playwright/test";

// Test credentials from bootstrap-data.ts
export const TEST_CREDENTIALS = {
  student: {
    studentLogin: "ST-100001",
    pin: "1111",
  },
  teacher: {
    email: "teacher@platform.local",
    password: "Teacher123!",
  },
  admin: {
    email: "admin@platform.local",
    password: "Admin123!",
  },
} as const;

// Session cookie name from src/lib/auth/session.ts
export const AUTH_COOKIE_NAME = "platform_auth_session";

/**
 * Login as a student using student login + PIN
 * Navigates to /auth/student/sign-in and submits the form
 */
export async function loginAsStudent(page: Page, credentials = TEST_CREDENTIALS.student): Promise<void> {
  await page.goto("/auth/student/login");
  
  await page.fill('input[name="studentLogin"]', credentials.studentLogin);
  await page.fill('input[name="pin"]', credentials.pin);
  await page.click('button[type="submit"]');
  
  // Wait for navigation to student dashboard
  await page.waitForURL("/student");
}

/**
 * Login as a teacher using email + password
 * Navigates to /auth/teacher/sign-in and submits the form
 */
export async function loginAsTeacher(page: Page, credentials = TEST_CREDENTIALS.teacher): Promise<void> {
  await page.goto("/auth/teacher/sign-in");
  
  await page.fill('input[name="email"]', credentials.email);
  await page.fill('input[name="password"]', credentials.password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation away from sign-in to teacher area (NOT /auth/)
  await page.waitForURL((url) => url.pathname.startsWith("/teacher"));
  // Wait for page content to confirm session cookie is fully established
  await page.waitForLoadState("load");
  await page.waitForSelector("main", { state: "visible", timeout: 20000 });
}

/**
 * Login as an admin using email + password
 * Same flow as teacher (admin uses same sign-in page)
 */
export async function loginAsAdmin(page: Page, credentials = TEST_CREDENTIALS.admin): Promise<void> {
  await page.goto("/auth/teacher/sign-in");
  
  await page.fill('input[name="email"]', credentials.email);
  await page.fill('input[name="password"]', credentials.password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation to admin dashboard
  await page.waitForURL("/admin");
}

/**
 * Logout by navigating to sign-out endpoint
 */
export async function logout(page: Page): Promise<void> {
  await page.goto("/auth/sign-out");
  await page.waitForURL("/");
}

/**
 * Check if user is authenticated by looking for auth cookie
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) => cookie.name === AUTH_COOKIE_NAME);
}
