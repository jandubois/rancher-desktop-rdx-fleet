import { test, expect, setupLocalStorage, mockGitHubApi } from './fixtures';

/**
 * E2E tests for GitHub Authentication Flow.
 *
 * Tests the GitHub auth card UI structure and basic interactions.
 * Note: Full authentication flows require complex CLI mocking and are
 * partially covered. See E2E_TESTING_PLAN.md for details.
 */
test.describe('GitHub Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up state with the GitHub auth card
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
          id: 'github-auth',
          type: 'auth-github',
          title: 'GitHub Authentication',
          settings: { required: false, show_status: true },
        },
      ],
      cardOrder: ['github-auth'],
    });

    await mockGitHubApi(page, { rateLimitRemaining: 55 });
  });

  test('should display GitHub auth card with title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Wait for the auth card to render
    await expect(page.getByText('GitHub Authentication')).toBeVisible();
  });

  test('should show description about authentication benefits', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show description
    await expect(page.getByText(/authenticate to increase api rate limits/i)).toBeVisible();
  });

  test('should display PAT input section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show the PAT input form section
    await expect(page.getByText('Personal Access Token')).toBeVisible();
  });

  test('should show "Create token on GitHub" link with correct URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Find the link
    const link = page.getByRole('link', { name: /create token on github/i });
    await expect(link).toBeVisible();

    // Check link has correct href
    await expect(link).toHaveAttribute('href', /github\.com\/settings\/tokens\/new/);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('should show PAT input placeholder', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show the PAT input field with placeholder
    await expect(page.getByPlaceholder('ghp_xxxxxxxxxxxxxxxxxxxx')).toBeVisible();
  });

  test('should show scope recommendations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Should show recommended scopes text
    await expect(page.getByText(/recommended scopes/i)).toBeVisible();
  });
});
