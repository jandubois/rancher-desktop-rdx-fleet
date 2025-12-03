import { test, expect } from '@playwright/test';

/**
 * Minimal smoke test to verify E2E setup works in CI.
 */
test('smoke test - page loads', async ({ page }) => {
  // Just navigate and check something renders
  await page.goto('/');

  // Wait for page to load (use 'load' not 'networkidle')
  await page.waitForLoadState('load');

  // Check that something rendered - the page should have content
  const body = page.locator('body');
  await expect(body).toBeVisible();

  // Log success for debugging
  console.log('Smoke test passed - page loaded successfully');
});
