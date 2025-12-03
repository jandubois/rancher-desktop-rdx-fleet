import { test, expect, setupLocalStorage } from './fixtures';

/**
 * E2E tests for AppCo (SUSE Application Collection) Authentication Flow.
 *
 * Tests the AppCo auth card UI structure and basic interactions.
 * Note: Full authentication flows require complex CLI mocking and are
 * partially covered. See E2E_TESTING_PLAN.md for details.
 */
test.describe('AppCo Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up state with the AppCo auth card
    await setupLocalStorage(page, {
      manifest: {
        app: { name: 'Fleet GitOps' },
        branding: {
          palette: {
            header: { background: '#1976d2', text: '#ffffff' },
            body: { background: '#f5f5f5' },
            card: { border: '#e0e0e0', title: '#333333' },
          },
        },
        cards: [],
        layout: { edit_mode: true },
      },
      manifestCards: [
        {
          id: 'appco-auth',
          type: 'auth-appco',
          title: 'AppCo Authentication',
          settings: { required: false, show_status: true },
        },
      ],
      cardOrder: ['appco-auth'],
    });
  });

  test('should display AppCo auth card with title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Wait for the auth card to render
    await expect(page.getByText('AppCo Authentication')).toBeVisible();
  });

  test('should show description about AppCo authentication', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show description
    await expect(page.getByText(/authenticate with suse application collection/i)).toBeVisible();
  });

  test('should display AppCo Credentials section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show the credential input form section
    await expect(page.getByText('AppCo Credentials')).toBeVisible();
  });

  test('should show username and token input fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show username and token fields
    await expect(page.getByLabel(/username or email/i)).toBeVisible();
    await expect(page.getByLabel(/access token/i)).toBeVisible();
  });

  test('should show "Authenticate" button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show the "Authenticate" button
    await expect(page.getByRole('button', { name: /^authenticate$/i })).toBeVisible();
  });

  test('should show external links to AppCo', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show "Get Account" link
    const getAccountLink = page.getByRole('link', { name: /get account/i });
    await expect(getAccountLink).toBeVisible();
    await expect(getAccountLink).toHaveAttribute('href', 'https://apps.rancher.io');
    await expect(getAccountLink).toHaveAttribute('target', '_blank');

    // Should show "Documentation" link
    const docsLink = page.getByRole('link', { name: /documentation/i });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute('href', 'https://apps.rancher.io/docs');
    await expect(docsLink).toHaveAttribute('target', '_blank');
  });

  // Note: Form interaction tests are skipped because the AppCo card checks for
  // credential helper availability, and when none is found the inputs are disabled.
  // Full form interaction testing would require mocking the credential helper.
});
