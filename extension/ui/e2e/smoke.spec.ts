import { test, expect } from './fixtures';

/**
 * Minimal smoke test using custom fixtures to verify E2E setup works in CI.
 */
test('smoke test - page loads with fixtures', async ({ page }) => {
  // Just navigate and check something renders
  await page.goto('/');
  await page.waitForLoadState('load');

  // Check that something rendered
  const body = page.locator('body');
  await expect(body).toBeVisible();

  console.log('Smoke test with fixtures passed');
});
