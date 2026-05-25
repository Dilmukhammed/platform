#!/usr/bin/env node
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT_DIR, ".sisyphus", "evidence", "perf");
const TRACE_DIR = path.join(EVIDENCE_DIR, "browser-traces");
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshots");
const MATRIX_PATH = path.join(EVIDENCE_DIR, "route-matrix.csv");
const DETAILS_PATH = path.join(EVIDENCE_DIR, "route-details.jsonl");

const CSV_HEADER = "mode,runType,from,to,durationMs,ttfbMs,consoleErrors,tracePath,notes";
const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 45_000;
const APP_CHECK_TIMEOUT_MS = 5_000;

const TEACHER_CREDENTIALS = {
  email: "teacher@platform.local",
  password: "Teacher123!",
};

const STUDENT_CREDENTIALS = {
  studentLogin: "ST-100001",
  pin: "1111",
};

const REQUIRED_ROUTES = [
  { from: "blank", to: "/", role: "public", label: "home" },
  { from: "/", to: "/auth/teacher/sign-in", role: "public", label: "teacher-signin" },
  { from: "/auth/teacher/sign-in", to: "/teacher", role: "teacher", label: "teacher-dashboard" },
  { from: "/teacher", to: "/teacher/reviews", role: "teacher", label: "teacher-reviews" },
  { from: "/teacher/reviews", to: "/teacher/students", role: "teacher", label: "teacher-students" },
  { from: "/teacher/students", to: "/teacher/assignments", role: "teacher", label: "teacher-assignments" },
  { from: "/teacher/classes", to: "DYNAMIC_TEACHER_CLASS_DETAIL", role: "teacher", label: "teacher-class-detail" },
  { from: "/auth/student/login", to: "/student", role: "student", label: "student-dashboard" },
  { from: "/student/classes", to: "DYNAMIC_STUDENT_CLASS_DETAIL", role: "student", label: "student-class-detail" },
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const help = args.has("--help") || args.has("-h");
const baseURL = normalizeBaseUrl(process.env.ROUTE_TIMING_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL);
const mode = process.env.ROUTE_TIMING_MODE ?? inferMode(baseURL);
const timeoutMs = Number(process.env.ROUTE_TIMING_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
const runTypes = parseRunTypes(process.env.ROUTE_TIMING_RUN_TYPES ?? "cold,warm");

if (help) {
  printHelp();
  process.exit(0);
}

await main();

async function main() {
  if (dryRun) {
    printDryRunPlan();
    await ensureEvidenceDirs();
    await ensureMatrixHeader();
    return;
  }

  await ensureEvidenceDirs();
  await resetEvidenceFiles();

  const appCheck = await checkAppAvailability(baseURL);
  if (!appCheck.ok) {
    const note = `BLOCKED_APP_UNAVAILABLE:${appCheck.reason}`;
    await writeRows(buildBlockedRows(note));
    await writeDetails(buildBlockedDetails(note));
    console.log(`[route-timing] App unavailable at ${baseURL}; wrote classified blocker rows to ${relativePath(MATRIX_PATH)}.`);
    return;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const note = `BLOCKED_BROWSER_LAUNCH:${sanitizeNote(error)}`;
    await writeRows(buildBlockedRows(note));
    await writeDetails(buildBlockedDetails(note));
    console.log(`[route-timing] Browser launch failed; wrote classified blocker rows to ${relativePath(MATRIX_PATH)}.`);
    return;
  }

  const rows = [];
  const details = [];

  try {
    await runPublicFlow(browser, rows, details);
    await runTeacherFlow(browser, rows, details);
    await runStudentFlow(browser, rows, details);
  } finally {
    await browser.close();
  }

  await writeRows(rows);
  await writeDetails(details);
  console.log(`[route-timing] Wrote ${rows.length} rows to ${relativePath(MATRIX_PATH)}.`);
  console.log(`[route-timing] Wrote navigation details to ${relativePath(DETAILS_PATH)}.`);
}

async function runPublicFlow(browser, rows, details) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleState = attachConsoleCapture(page);

  try {
    if (runTypes.includes("cold")) {
      await measureNavigation({ page, context, consoleState, rows, details, runType: "cold", label: "home", role: "public", target: "/", method: "GOTO" });
      await measureNavigation({ page, context, consoleState, rows, details, runType: "cold", label: "teacher-signin", role: "public", target: "/auth/teacher/sign-in", method: "CLICK_LINK" });
    }

    if (runTypes.includes("warm")) {
      await measureNavigation({ page, context, consoleState, rows, details, runType: "warm", label: "home", role: "public", target: "/", method: "GOTO" });
      await measureNavigation({ page, context, consoleState, rows, details, runType: "warm", label: "teacher-signin", role: "public", target: "/auth/teacher/sign-in", method: "CLICK_LINK" });
    }
  } finally {
    await context.close();
  }
}

async function runTeacherFlow(browser, rows, details) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleState = attachConsoleCapture(page);

  try {
    let authenticated = true;

    if (runTypes.includes("cold")) {
      authenticated = await loginAsTeacher(page, context, consoleState, rows, details, "cold");
      if (authenticated) {
        await runTeacherRouteSequence(page, context, consoleState, rows, details, "cold");
      } else {
        addAuthBlockedRows(rows, details, "cold", "teacher", "BLOCKED_TEACHER_LOGIN");
      }
    }

    if (runTypes.includes("warm")) {
      if (!authenticated && !runTypes.includes("cold")) {
        authenticated = await loginAsTeacher(page, context, consoleState, rows, details, "warm");
      }

      if (authenticated) {
        await measureNavigation({ page, context, consoleState, rows, details, runType: "warm", label: "teacher-dashboard", role: "teacher", target: "/teacher", method: "GOTO" });
        await runTeacherRouteSequence(page, context, consoleState, rows, details, "warm");
      } else {
        addAuthBlockedRows(rows, details, "warm", "teacher", "BLOCKED_TEACHER_LOGIN");
      }
    }
  } finally {
    await context.close();
  }
}

async function runTeacherRouteSequence(page, context, consoleState, rows, details, runType) {
  await measureNavigation({ page, context, consoleState, rows, details, runType, label: "teacher-reviews", role: "teacher", target: "/teacher/reviews", method: "CLICK_LINK" });
  await measureNavigation({ page, context, consoleState, rows, details, runType, label: "teacher-students", role: "teacher", target: "/teacher/students", method: "CLICK_LINK" });
  await measureNavigation({ page, context, consoleState, rows, details, runType, label: "teacher-assignments", role: "teacher", target: "/teacher/assignments", method: "CLICK_LINK" });
  await measureNavigation({ page, context, consoleState, rows, details, runType, label: "teacher-classes-index", role: "teacher", target: "/teacher/classes", method: "GOTO", extraNotes: ["SUPPORT_CLASS_INDEX"] });

  const classLink = await findFirstClassDetailLink(page, "teacher");
  if (!classLink) {
    addSkippedClassLinkRow(rows, details, runType, "teacher", currentPath(page));
    return;
  }

  await measureNavigation({ page, context, consoleState, rows, details, runType, label: "teacher-class-detail", role: "teacher", target: classLink, method: "CLICK_DYNAMIC_LINK" });
}

async function runStudentFlow(browser, rows, details) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleState = attachConsoleCapture(page);

  try {
    let authenticated = true;

    if (runTypes.includes("cold")) {
      authenticated = await loginAsStudent(page, context, consoleState, rows, details, "cold");
      if (authenticated) {
        await runStudentRouteSequence(page, context, consoleState, rows, details, "cold");
      } else {
        addAuthBlockedRows(rows, details, "cold", "student", "BLOCKED_STUDENT_LOGIN");
      }
    }

    if (runTypes.includes("warm")) {
      if (!authenticated && !runTypes.includes("cold")) {
        authenticated = await loginAsStudent(page, context, consoleState, rows, details, "warm");
      }

      if (authenticated) {
        await measureNavigation({ page, context, consoleState, rows, details, runType: "warm", label: "student-dashboard", role: "student", target: "/student", method: "GOTO" });
        await runStudentRouteSequence(page, context, consoleState, rows, details, "warm");
      } else {
        addAuthBlockedRows(rows, details, "warm", "student", "BLOCKED_STUDENT_LOGIN");
      }
    }
  } finally {
    await context.close();
  }
}

async function runStudentRouteSequence(page, context, consoleState, rows, details, runType) {
  await measureNavigation({ page, context, consoleState, rows, details, runType, label: "student-classes-index", role: "student", target: "/student/classes", method: "GOTO", extraNotes: ["SUPPORT_CLASS_INDEX"] });

  const classLink = await findFirstClassDetailLink(page, "student");
  if (!classLink) {
    addSkippedClassLinkRow(rows, details, runType, "student", currentPath(page));
    return;
  }

  await measureNavigation({ page, context, consoleState, rows, details, runType, label: "student-class-detail", role: "student", target: classLink, method: "CLICK_DYNAMIC_LINK" });
}

async function loginAsTeacher(page, context, consoleState, rows, details, runType) {
  await safeGoto(page, "/auth/teacher/sign-in");

  const result = await measureNavigation({
    page,
    context,
    consoleState,
    rows,
    details,
    runType,
    label: "teacher-login",
    role: "teacher",
    target: "/teacher",
    method: "FORM_SUBMIT",
    action: async (notes) => {
      await page.fill('input[name="email"]', TEACHER_CREDENTIALS.email);
      await page.fill('input[name="password"]', TEACHER_CREDENTIALS.password);
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/teacher", { timeout: timeoutMs }),
        page.click('button[type="submit"]'),
      ]).catch((error) => notes.push(`ACTION_ERROR:${sanitizeNote(error)}`));
    },
  });

  const ok = result.finalPath === "/teacher";
  if (!ok) {
    result.row.notes.push("BLOCKED_TEACHER_LOGIN");
  }
  return ok;
}

async function loginAsStudent(page, context, consoleState, rows, details, runType) {
  await safeGoto(page, "/auth/student/login");

  const result = await measureNavigation({
    page,
    context,
    consoleState,
    rows,
    details,
    runType,
    label: "student-login",
    role: "student",
    target: "/student",
    method: "FORM_SUBMIT",
    action: async (notes) => {
      await page.fill('input[name="studentLogin"]', STUDENT_CREDENTIALS.studentLogin);
      await page.fill('input[name="pin"]', STUDENT_CREDENTIALS.pin);
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/student", { timeout: timeoutMs }),
        page.click('button[type="submit"]'),
      ]).catch((error) => notes.push(`ACTION_ERROR:${sanitizeNote(error)}`));
    },
  });

  const ok = result.finalPath === "/student";
  if (!ok) {
    result.row.notes.push("BLOCKED_STUDENT_LOGIN");
  }
  return ok;
}

async function measureNavigation({ page, context, consoleState, rows, details, runType, label, role, target, method, action, extraNotes = [] }) {
  const notes = [`ROLE:${role}`, `METHOD:${method}`, ...extraNotes];
  const from = currentPath(page);
  const consoleStart = consoleState.errors.length;
  const responses = [];
  const responseListener = async (response) => {
    try {
      const url = new URL(response.url());
      const timing = response.timing();
      responses.push({
        url: response.url(),
        path: `${url.pathname}${url.search}`,
        status: response.status(),
        method: response.request().method(),
        resourceType: response.request().resourceType(),
        responseStart: timing.responseStart,
      });
    } catch {
      // Ignore malformed or browser-internal response URLs.
    }
  };

  const startedAt = Date.now();
  const tracePath = path.join(TRACE_DIR, `${mode}-${runType}-${slug(label)}-${startedAt}.zip`);
  const screenshotPath = path.join(SCREENSHOT_DIR, `${mode}-${runType}-${slug(label)}-${startedAt}.png`);

  console.log(`[route-timing] start mode=${mode} runType=${runType} from=${from} target=${target} url=${absoluteUrl(target)}`);

  page.on("response", responseListener);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false }).catch((error) => {
    notes.push(`TRACE_START_ERROR:${sanitizeNote(error)}`);
  });

  try {
    if (action) {
      await action(notes);
    } else if (method === "CLICK_LINK" || method === "CLICK_DYNAMIC_LINK") {
      await clickLinkOrGoto(page, target, notes);
    } else {
      await page.goto(absoluteUrl(target), { waitUntil: "domcontentloaded", timeout: timeoutMs });
    }

    await waitForPageSettled(page, notes);
  } catch (error) {
    notes.push(`ACTION_ERROR:${sanitizeNote(error)}`);
    await waitForPageSettled(page, notes);
  } finally {
    page.off("response", responseListener);
    await context.tracing.stop({ path: tracePath }).catch((error) => {
      notes.push(`TRACE_STOP_ERROR:${sanitizeNote(error)}`);
    });
  }

  const durationMs = Date.now() - startedAt;
  const finalUrl = page.url();
  const finalPath = currentPath(page);
  const title = await page.title().catch(() => "");
  const heading = await visibleHeading(page);
  const consoleErrors = consoleState.errors.slice(consoleStart);
  const ttfbMs = findTtfbMs(responses, target, finalPath);

  await page.screenshot({ path: screenshotPath, fullPage: true }).catch((error) => {
    notes.push(`SCREENSHOT_ERROR:${sanitizeNote(error)}`);
  });

  if (!heading) notes.push("NO_HEADING");
  if (pathOnly(target) !== finalPath && !target.startsWith("DYNAMIC_")) notes.push(`UNEXPECTED_FINAL_URL:${finalPath}`);

  const row = {
    mode,
    runType,
    from,
    to: finalPath || pathOnly(target),
    durationMs,
    ttfbMs,
    consoleErrors: consoleErrors.length,
    tracePath: relativePath(tracePath),
    notes,
  };

  rows.push(row);
  details.push({
    mode,
    runType,
    label,
    from,
    target,
    finalUrl,
    finalPath,
    title,
    heading,
    durationMs,
    ttfbMs,
    consoleErrors,
    tracePath: relativePath(tracePath),
    screenshotPath: relativePath(screenshotPath),
    notes,
    responses,
  });

  console.log(`[route-timing] done mode=${mode} runType=${runType} from=${from} target=${target} final=${finalPath} title=${JSON.stringify(title)} heading=${JSON.stringify(heading)} durationMs=${durationMs} ttfbMs=${ttfbMs ?? ""} consoleErrors=${consoleErrors.length} trace=${relativePath(tracePath)} screenshot=${relativePath(screenshotPath)}`);
  return { finalPath, row };
}

async function clickLinkOrGoto(page, target, notes) {
  const targetPath = pathOnly(target);
  const exactLink = page.locator(`a[href="${targetPath}"], a[href^="${targetPath}?"]`).first();
  const linkCount = await exactLink.count().catch(() => 0);

  if (linkCount > 0 && await exactLink.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForURL((url) => url.pathname === targetPath, { timeout: timeoutMs }).catch((error) => notes.push(`ACTION_ERROR:${sanitizeNote(error)}`)),
      exactLink.click(),
    ]);
    return;
  }

  notes.push("FALLBACK_DIRECT_GOTO");
  await page.goto(absoluteUrl(targetPath), { waitUntil: "domcontentloaded", timeout: timeoutMs });
}

async function findFirstClassDetailLink(page, role) {
  const prefix = role === "teacher" ? "/teacher/classes/" : "/student/classes/";
  return page.evaluate((linkPrefix) => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => {
        const rawHref = anchor.getAttribute("href") ?? "";
        const url = new URL(rawHref, window.location.origin);
        return {
          path: url.pathname,
          text: anchor.textContent?.trim() ?? "",
        };
      })
      .filter((link) => link.path.startsWith(linkPrefix))
      .filter((link) => !link.path.endsWith("/new"))
      .filter((link) => /^\/(teacher|student)\/classes\/[^/?#]+$/.test(link.path))
      .sort((a, b) => `${a.path}\u0000${a.text}`.localeCompare(`${b.path}\u0000${b.text}`))[0]?.path ?? null;
  }, prefix).catch(() => null);
}

function addSkippedClassLinkRow(rows, details, runType, role, from) {
  const notes = [`ROLE:${role}`, "METHOD:CLICK_DYNAMIC_LINK", "SKIPPED_NO_CLASS_LINK"];
  const row = {
    mode,
    runType,
    from,
    to: "SKIPPED_NO_CLASS_LINK",
    durationMs: 0,
    ttfbMs: null,
    consoleErrors: 0,
    tracePath: "",
    notes,
  };
  rows.push(row);
  details.push({ mode, runType, label: `${role}-class-detail`, from, target: `${role}-class-detail`, finalPath: "SKIPPED_NO_CLASS_LINK", title: "", heading: "", durationMs: 0, ttfbMs: null, consoleErrors: [], tracePath: null, screenshotPath: null, notes, responses: [] });
  console.log(`[route-timing] skipped role=${role} runType=${runType} reason=SKIPPED_NO_CLASS_LINK from=${from}`);
}

function addAuthBlockedRows(rows, details, runType, role, reason) {
  const roleRows = REQUIRED_ROUTES.filter((route) => route.role === role && !route.to.endsWith(role === "teacher" ? "/teacher" : "/student"));
  for (const route of roleRows) {
    const notes = [`ROLE:${role}`, reason];
    const row = {
      mode,
      runType,
      from: route.from,
      to: route.to.startsWith("DYNAMIC_") ? reason : route.to,
      durationMs: 0,
      ttfbMs: null,
      consoleErrors: 0,
      tracePath: "",
      notes,
    };
    rows.push(row);
    details.push({ mode, runType, label: route.label, from: row.from, target: route.to, finalPath: row.to, title: "", heading: "", durationMs: 0, ttfbMs: null, consoleErrors: [], tracePath: null, screenshotPath: null, notes, responses: [] });
  }
}

function buildBlockedRows(note) {
  return runTypes.flatMap((runType) => REQUIRED_ROUTES.map((route) => ({
    mode,
    runType,
    from: route.from,
    to: route.to.startsWith("DYNAMIC_") ? note.split(":")[0] : route.to,
    durationMs: 0,
    ttfbMs: null,
    consoleErrors: 0,
    tracePath: "",
    notes: [`ROLE:${route.role}`, note],
  })));
}

function buildBlockedDetails(note) {
  return runTypes.flatMap((runType) => REQUIRED_ROUTES.map((route) => ({
    mode,
    runType,
    label: route.label,
    from: route.from,
    target: route.to,
    finalUrl: null,
    finalPath: route.to.startsWith("DYNAMIC_") ? note.split(":")[0] : route.to,
    title: "",
    heading: "",
    durationMs: 0,
    ttfbMs: null,
    consoleErrors: [],
    tracePath: null,
    screenshotPath: null,
    notes: [`ROLE:${route.role}`, note],
    responses: [],
  })));
}

async function checkAppAvailability(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APP_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    if (response.status >= 500) {
      return { ok: false, reason: `HTTP_${response.status}` };
    }
    return { ok: true, reason: `HTTP_${response.status}` };
  } catch (error) {
    const prefix = error?.name === "AbortError" ? `FETCH_TIMEOUT_${APP_CHECK_TIMEOUT_MS}MS` : "FETCH_ERROR";
    return { ok: false, reason: `${prefix}:${sanitizeNote(error)}` };
  } finally {
    clearTimeout(timer);
  }
}

async function safeGoto(page, target) {
  await page.goto(absoluteUrl(target), { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => undefined);
  await waitForPageSettled(page, []);
}

async function waitForPageSettled(page, notes) {
  await page.waitForLoadState("domcontentloaded", { timeout: Math.min(timeoutMs, 10_000) }).catch((error) => notes.push(`DOMCONTENTLOADED_TIMEOUT:${sanitizeNote(error)}`));
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 7_500) }).catch((error) => notes.push(`NETWORKIDLE_TIMEOUT:${sanitizeNote(error)}`));
  await page.locator("body").waitFor({ state: "visible", timeout: Math.min(timeoutMs, 10_000) }).catch((error) => notes.push(`BODY_VISIBLE_TIMEOUT:${sanitizeNote(error)}`));
}

async function visibleHeading(page) {
  const heading = page.locator("h1, h2, [role='heading']").filter({ visible: true }).first();
  return heading.textContent({ timeout: 2_000 }).then((text) => text?.trim() ?? "").catch(() => "");
}

function attachConsoleCapture(page) {
  const state = { errors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") state.errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    state.errors.push(sanitizeNote(error));
  });
  return state;
}

function findTtfbMs(responses, target, finalPath) {
  const targetPath = pathOnly(target);
  const matching = responses.find((response) => {
    const responsePath = response.path.split("?")[0];
    const expectedPath = finalPath || targetPath;
    return response.responseStart >= 0 && (responsePath === expectedPath || responsePath === targetPath);
  });

  return matching ? Math.round(matching.responseStart) : null;
}

async function ensureEvidenceDirs() {
  await fs.mkdir(TRACE_DIR, { recursive: true });
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
}

async function ensureMatrixHeader() {
  try {
    const existing = await fs.readFile(MATRIX_PATH, "utf8");
    if (existing.split(/\r?\n/)[0] === CSV_HEADER) return;
  } catch {
    // Create below when missing.
  }

  await fs.writeFile(MATRIX_PATH, `${CSV_HEADER}\n`, "utf8");
}

async function resetEvidenceFiles() {
  await fs.writeFile(MATRIX_PATH, `${CSV_HEADER}\n`, "utf8");
  await fs.writeFile(DETAILS_PATH, "", "utf8");
}

async function writeRows(rows) {
  const lines = rows.map((row) => [
    row.mode,
    row.runType,
    row.from,
    row.to,
    row.durationMs,
    row.ttfbMs ?? "",
    row.consoleErrors,
    row.tracePath,
    row.notes.join("|"),
  ].map(csvField).join(","));

  await fs.appendFile(MATRIX_PATH, `${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`, "utf8");
}

async function writeDetails(details) {
  if (details.length === 0) return;
  await fs.appendFile(DETAILS_PATH, `${details.map((detail) => JSON.stringify(detail)).join("\n")}\n`, "utf8");
}

function csvField(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  if (/[",\r\n,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function absoluteUrl(target) {
  return new URL(target, baseURL).toString();
}

function currentPath(page) {
  try {
    const url = page.url();
    if (!url || url === "about:blank") return "blank";
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "blank";
  }
}

function pathOnly(target) {
  if (target.startsWith("DYNAMIC_")) return target;
  return new URL(target, baseURL).pathname;
}

function normalizeBaseUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  return parsed.toString().replace(/\/$/, "");
}

function inferMode(url) {
  const parsed = new URL(url);
  if (parsed.port === "3000") return "dev";
  return parsed.port ? `port-${parsed.port}` : parsed.protocol.replace(":", "");
}

function parseRunTypes(value) {
  const parsed = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const valid = parsed.filter((entry) => entry === "cold" || entry === "warm");
  return valid.length > 0 ? valid : ["cold", "warm"];
}

function relativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sanitizeNote(value) {
  return String(value?.message ?? value)
    .replaceAll(TEACHER_CREDENTIALS.password, "[redacted-teacher-password]")
    .replaceAll(STUDENT_CREDENTIALS.pin, "[redacted-student-pin]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function printHelp() {
  console.log(`Route timing harness\n\nUsage:\n  npm run perf:routes -- [--dry-run]\n  node scripts/route-timing-harness.mjs [--dry-run]\n\nEnvironment:\n  ROUTE_TIMING_BASE_URL      App URL to measure (default: ${DEFAULT_BASE_URL})\n  ROUTE_TIMING_MODE          CSV mode label (default inferred from URL)\n  ROUTE_TIMING_RUN_TYPES     cold,warm or one value (default: cold,warm)\n  ROUTE_TIMING_TIMEOUT_MS    Navigation timeout in ms (default: ${DEFAULT_TIMEOUT_MS})\n\nEvidence written on real runs:\n  ${relativePath(MATRIX_PATH)}\n  ${relativePath(DETAILS_PATH)}\n  ${relativePath(TRACE_DIR)}/\n  ${relativePath(SCREENSHOT_DIR)}/\n`);
}

function printDryRunPlan() {
  console.log(`[route-timing] dry-run baseURL=${baseURL} mode=${mode} runTypes=${runTypes.join(",")}`);
  for (const runType of runTypes) {
    for (const route of REQUIRED_ROUTES) {
      console.log(`[route-timing] plan runType=${runType} role=${route.role} from=${route.from} to=${route.to}`);
    }
  }
  console.log(`[route-timing] dry-run does not launch a browser or submit credentials. Ensured CSV header at ${relativePath(MATRIX_PATH)}.`);
}
