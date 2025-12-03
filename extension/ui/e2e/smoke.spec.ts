import { test, expect, clearLocalStorage } from './fixtures';

/**
 * Smoke tests to isolate what's causing the hang.
 */

test('smoke 1 - just goto and check body', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await expect(page.locator('body')).toBeVisible();
  console.log('smoke 1 passed');
});

test('smoke 2 - with clearLocalStorage', async ({ page }) => {
  await clearLocalStorage(page);
  await page.goto('/');
  await page.waitForLoadState('load');
  await expect(page.locator('body')).toBeVisible();
  console.log('smoke 2 passed');
});

test('smoke 3 - check for edit button', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');

  // Log what we see
  const buttons = await page.getByRole('button').all();
  console.log(`Found ${buttons.length} buttons`);
  for (const btn of buttons) {
    const name = await btn.getAttribute('aria-label') || await btn.textContent();
    console.log(`Button: ${name}`);
  }

  console.log('smoke 3 passed');
});
