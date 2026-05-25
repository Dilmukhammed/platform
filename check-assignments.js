import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Navigate to teacher login
  await page.goto('http://localhost:3002/auth/teacher/sign-in');
  
  // Fill in credentials
  await page.fill('input[name="email"]', 'teacher@platform.local');
  await page.fill('input[name="password"]', 'Teacher123!');
  await page.click('button[type="submit"]');

  // Wait for navigation to teacher dashboard
  await page.waitForURL('**/teacher**', { timeout: 10000 });

  // Navigate to assignments page
  await page.goto('http://localhost:3002/teacher/assignments');
  await page.waitForLoadState('domcontentloaded');

  // Take screenshot
  await page.screenshot({ path: '.sisyphus/evidence/qa/task-1-assignments-page.png', fullPage: true });

  // Get page info
  const url = page.url();
  const title = await page.title();
  const bodyText = await page.textContent('body').then(t => t?.slice(0, 500));

  console.log({ url, title, bodyText: bodyText?.slice(0, 200) });
  await browser.close();
})();