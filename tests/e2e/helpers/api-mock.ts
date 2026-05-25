import type { Page, Route } from "@playwright/test";

/**
 * Mock API response for a specific route
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: {
    status?: number;
    body?: object;
    headers?: Record<string, string>;
  }
): Promise<void> {
  await page.route(urlPattern, async (route: Route) => {
    await route.fulfill({
      status: response.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(response.body ?? {}),
      headers: response.headers,
    });
  });
}

/**
 * Mock API error response
 */
export async function mockApiError(
  page: Page,
  urlPattern: string | RegExp,
  status: number,
  errorMessage: string
): Promise<void> {
  await page.route(urlPattern, async (route: Route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ error: errorMessage }),
    });
  });
}

/**
 * Abort API request (simulate network failure)
 */
export async function abortApiRequest(
  page: Page,
  urlPattern: string | RegExp,
  errorCode: "failed" | "timedout" | "aborted" = "failed"
): Promise<void> {
  await page.route(urlPattern, async (route: Route) => {
    await route.abort(errorCode);
  });
}

/**
 * Wait for API request to be made
 */
export async function waitForApiRequest(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForRequest(urlPattern);
}

/**
 * Wait for API response to be received
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForResponse(urlPattern);
}

/**
 * Clear all route mocks for a page
 */
export async function clearMocks(page: Page): Promise<void> {
  await page.unrouteAll();
}
