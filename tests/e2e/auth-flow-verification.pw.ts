import { test, expect } from "@playwright/test";
import { loginAsTeacher, loginAsStudent, TEST_CREDENTIALS } from "./helpers/auth";
import { timedAction, createTimingEntry, writeTimingReport } from "./helpers/timing";

const BASE_URL = "http://localhost:3002";

test.describe("Auth Flow Verification with Timing", () => {
  test("Teacher login flow", async ({ page }) => {
    // Wait to avoid rate limiting
    await page.waitForTimeout(2000);
    
    const result = await timedAction("Teacher Login", async () => {
      await page.goto(`${BASE_URL}/auth/teacher/sign-in`);
      await page.fill('input[name="email"]', TEST_CREDENTIALS.teacher.email);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.teacher.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/teacher`);
    });

    // Use 15s threshold for first login (cold start)
    const passed = result.durationMs < 15000;
    const entry = createTimingEntry(
      "Teacher Login",
      "Full login flow",
      result.durationMs,
      passed ? "pass" : "fail",
      passed ? `Completed in ${result.durationMs.toFixed(2)}ms` : `Exceeded 15s threshold: ${result.durationMs.toFixed(2)}ms`
    );
    writeTimingReport([entry]);

    await page.screenshot({ path: ".sisyphus/evidence/qa/task-3-teacher-login.png" });
    expect(passed, `Teacher login should complete, took ${result.durationMs.toFixed(2)}ms`).toBe(true);
  });

  test("Student login flow", async ({ page }) => {
    await page.waitForTimeout(2000);
    
    const result = await timedAction("Student Login", async () => {
      await page.goto(`${BASE_URL}/auth/student/login`);
      await page.fill('input[name="studentLogin"]', TEST_CREDENTIALS.student.studentLogin);
      await page.fill('input[name="pin"]', TEST_CREDENTIALS.student.pin);
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/student`);
    });

    const passed = result.durationMs < 15000;
    const entry = createTimingEntry(
      "Student Login",
      "Full login flow",
      result.durationMs,
      passed ? "pass" : "fail",
      passed ? `Completed in ${result.durationMs.toFixed(2)}ms` : `Exceeded 15s threshold: ${result.durationMs.toFixed(2)}ms`
    );
    writeTimingReport([entry]);

    await page.screenshot({ path: ".sisyphus/evidence/qa/task-3-student-login.png" });
    expect(passed, `Student login should complete, took ${result.durationMs.toFixed(2)}ms`).toBe(true);
  });

  test("Session endpoint returns correct role - Teacher", async ({ page }) => {
    await page.waitForTimeout(2000);
    await loginAsTeacher(page);

    const result = await timedAction("Session API - Teacher", async () => {
      const response = await page.request.get(`${BASE_URL}/api/v1/session`);
      return await response.json();
    });

    const sessionData = result.result;
    const roleCorrect = sessionData?.principal?.role === "teacher";

    const entry = createTimingEntry(
      "Session Verification",
      "Teacher role check",
      result.durationMs,
      roleCorrect ? "pass" : "fail",
      `Role returned: ${sessionData?.principal?.role}`
    );
    writeTimingReport([entry]);

    await page.screenshot({ path: ".sisyphus/evidence/qa/task-3-session-teacher.png" });
    expect(roleCorrect, `Session should return teacher role, got: ${sessionData?.principal?.role}`).toBe(true);
  });

  test("Session endpoint returns correct role - Student", async ({ page }) => {
    await page.waitForTimeout(2000);
    await loginAsStudent(page);

    const result = await timedAction("Session API - Student", async () => {
      const response = await page.request.get(`${BASE_URL}/api/v1/session`);
      return await response.json();
    });

    const sessionData = result.result;
    const roleCorrect = sessionData?.principal?.role === "student";

    const entry = createTimingEntry(
      "Session Verification",
      "Student role check",
      result.durationMs,
      roleCorrect ? "pass" : "fail",
      `Role returned: ${sessionData?.principal?.role}`
    );
    writeTimingReport([entry]);

    await page.screenshot({ path: ".sisyphus/evidence/qa/task-3-session-student.png" });
    expect(roleCorrect, `Session should return student role, got: ${sessionData?.principal?.role}`).toBe(true);
  });

  test("Logout redirects correctly", async ({ page }) => {
    await page.waitForTimeout(2000);
    await loginAsTeacher(page);

    const result = await timedAction("Logout", async () => {
      await page.goto(`${BASE_URL}/auth/sign-out`);
      await page.waitForURL(`${BASE_URL}/`);
    });

    const redirected = page.url() === `${BASE_URL}/`;

    const entry = createTimingEntry(
      "Logout",
      "Redirect to home",
      result.durationMs,
      redirected ? "pass" : "fail",
      `Redirected to: ${page.url()}`
    );
    writeTimingReport([entry]);

    await page.screenshot({ path: ".sisyphus/evidence/qa/task-3-logout.png" });
    expect(redirected, `Should redirect to home after logout`).toBe(true);
  });

  test("Middleware protection - unauthenticated access to /teacher", async ({ page }) => {
    const result = await timedAction("Middleware Protection", async () => {
      await page.goto(`${BASE_URL}/teacher`);
      await page.waitForURL(`${BASE_URL}/auth/teacher/sign-in`, { timeout: 5000 });
    });

    const redirected = page.url().includes("/auth/teacher/sign-in");

    const entry = createTimingEntry(
      "Middleware Protection",
      "Unauthenticated /teacher access",
      result.durationMs,
      redirected ? "pass" : "fail",
      `Redirected to: ${page.url()}`
    );
    writeTimingReport([entry]);

    await page.screenshot({ path: ".sisyphus/evidence/qa/task-3-middleware-protection.png" });
    expect(redirected, `Should redirect unauthenticated user to login`).toBe(true);
  });

  test("Role mismatch - student accessing /teacher", async ({ page }) => {
    await page.waitForTimeout(2000);
    await loginAsStudent(page);

    const result = await timedAction("Role Mismatch Redirect", async () => {
      await page.goto(`${BASE_URL}/teacher`);
      await page.waitForURL(`${BASE_URL}/student`, { timeout: 5000 });
    });

    const redirected = page.url() === `${BASE_URL}/student`;

    const entry = createTimingEntry(
      "Role Mismatch",
      "Student accessing /teacher",
      result.durationMs,
      redirected ? "pass" : "fail",
      `Redirected to: ${page.url()}`
    );
    writeTimingReport([entry]);

    await page.screenshot({ path: ".sisyphus/evidence/qa/task-3-role-mismatch.png" });
    expect(redirected, `Should redirect student to /student when accessing /teacher`).toBe(true);
  });
});