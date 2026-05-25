const { chromium } = require("playwright");

async function auditPages() {
  const BASE = "http://localhost:3000";
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = {};
  
  const pages = [
    { path: "/auth/teacher/sign-in", name: "Sign In" },
    { path: "/auth/teacher/sign-up", name: "Sign Up" },
    { path: "/teacher", name: "Dashboard" },
    { path: "/teacher/classes", name: "Classes" },
    { path: "/teacher/materials", name: "Materials" },
    { path: "/teacher/tests", name: "Tests" },
    { path: "/teacher/reviews", name: "Reviews" },
    { path: "/teacher/notifications", name: "Notifications" },
    { path: "/teacher/settings", name: "Profile/Settings" },
    { path: "/teacher/students", name: "Students" },
    { path: "/teacher/library", name: "Library" },
    { path: "/teacher/assignments", name: "Assignments" },
    { path: "/teacher/publications", name: "Publications" },
    { path: "/teacher/gradebook", name: "Gradebook" },
  ];
  
  // Login first
  console.log("Logging in as teacher...");
  await page.goto(BASE + "/auth/teacher/sign-in");
  await page.fill('input[name="email"]', "teacher@platform.local");
  await page.fill('input[name="password"]', "Teacher123!");
  await page.click('button[type="submit"]');
  await page.waitForURL(BASE + "/teacher", { timeout: 10000 });
  console.log("Logged in successfully");
  
  for (const p of pages) {
    try {
      console.log("Auditing: " + p.name + " (" + p.path + ")");
      await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 15000 });
      
      // Get h1 text
      const h1 = await page.locator("h1").first().textContent().catch(() => "No h1");
      
      // Get sidebar nav items
      const sidebarItems = await page.locator("nav a, aside a").allTextContents().catch(() => []);
      
      // Get button text (first 10)
      const buttons = await page.locator("button").allTextContents().catch(() => []);
      
      // Get main input labels
      const labels = await page.locator("label").allTextContents().catch(() => []);
      
      // Get page title
      const title = await page.title();
      
      results[p.name] = {
        path: p.path,
        h1: h1 ? h1.trim() : null,
        title: title ? title.trim() : null,
        sidebarSample: sidebarItems.slice(0, 5).map(function(t) { return t.trim(); }).filter(Boolean),
        buttonsSample: buttons.slice(0, 10).map(function(t) { return t.trim(); }).filter(Boolean),
        labelsSample: labels.slice(0, 10).map(function(t) { return t.trim(); }).filter(Boolean),
      };
    } catch (e) {
      results[p.name] = { path: p.path, error: e.message };
    }
  }
  
  await browser.close();
  
  // Output as JSON for parsing
  console.log("\n===RESULTS_START===");
  console.log(JSON.stringify(results, null, 2));
  console.log("===RESULTS_END===");
}

auditPages().catch(console.error);
