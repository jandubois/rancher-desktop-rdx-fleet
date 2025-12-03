import { test, expect, setupLocalStorage, clearLocalStorage, getLocalStorageState } from './fixtures';

/**
 * E2E tests for Edit Mode functionality.
 *
 * Tests the snapshot/restore pattern:
 * - Enter edit mode captures state snapshot
 * - Cancel restores to snapshot
 * - Apply saves changes
 * - Changes persist across page reload
 */
test.describe('Edit Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean state
    await clearLocalStorage(page);
  });

  test('should enter and exit edit mode with Cancel', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify we start in view mode (edit button visible)
    const editButton = page.getByRole('button', { name: /enter edit mode/i });
    await expect(editButton).toBeVisible();

    // Enter edit mode
    await editButton.click();

    // Verify edit mode UI appears
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apply/i })).toBeVisible();

    // Cancel should exit edit mode
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify we're back in view mode
    await expect(editButton).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).not.toBeVisible();
  });

  test('should enter and exit edit mode with Apply', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enter edit mode
    await page.getByRole('button', { name: /enter edit mode/i }).click();

    // Verify edit mode
    await expect(page.getByRole('button', { name: /apply/i })).toBeVisible();

    // Apply should exit edit mode
    await page.getByRole('button', { name: /apply/i }).click();

    // Verify we're back in view mode
    await expect(page.getByRole('button', { name: /enter edit mode/i })).toBeVisible();
  });

  test('should restore title on Cancel', async ({ page }) => {
    // Set up initial state with a specific title
    await setupLocalStorage(page, {
      manifest: {
        app: { name: 'Original Title' },
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
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify original title is shown
    await expect(page.getByText('Original Title')).toBeVisible();

    // Enter edit mode
    await page.getByRole('button', { name: /enter edit mode/i }).click();

    // Find and modify the title input
    const titleInput = page.locator('input[placeholder="Extension Name"]');
    await titleInput.clear();
    await titleInput.fill('Changed Title');

    // Verify the title changed
    await expect(titleInput).toHaveValue('Changed Title');

    // Cancel edit mode
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify title was restored to original
    await expect(page.getByText('Original Title')).toBeVisible();
  });

  test('should persist title on Apply', async ({ page }) => {
    // Set up initial state
    await setupLocalStorage(page, {
      manifest: {
        app: { name: 'Original Title' },
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
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enter edit mode
    await page.getByRole('button', { name: /enter edit mode/i }).click();

    // Modify the title
    const titleInput = page.locator('input[placeholder="Extension Name"]');
    await titleInput.clear();
    await titleInput.fill('New Title');

    // Apply changes
    await page.getByRole('button', { name: /apply/i }).click();

    // Verify new title is shown
    await expect(page.getByText('New Title')).toBeVisible();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify title persisted
    await expect(page.getByText('New Title')).toBeVisible();
  });

  test('should show Edit panel with tabs in edit mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enter edit mode
    await page.getByRole('button', { name: /enter edit mode/i }).click();

    // Verify edit panel tabs are visible
    await expect(page.getByRole('tab', { name: /edit/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /load/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /build/i })).toBeVisible();

    // Edit tab should be selected by default
    await expect(page.getByRole('tab', { name: /edit/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('should switch between edit panel tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enter edit mode
    await page.getByRole('button', { name: /enter edit mode/i }).click();

    // Click Load tab
    await page.getByRole('tab', { name: /load/i }).click();
    await expect(page.getByRole('tab', { name: /load/i })).toHaveAttribute('aria-selected', 'true');

    // Click Build tab
    await page.getByRole('tab', { name: /build/i }).click();
    await expect(page.getByRole('tab', { name: /build/i })).toHaveAttribute('aria-selected', 'true');

    // Click back to Edit tab
    await page.getByRole('tab', { name: /edit/i }).click();
    await expect(page.getByRole('tab', { name: /edit/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('should persist changes to localStorage', async ({ page }) => {
    await clearLocalStorage(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enter edit mode and make a change
    await page.getByRole('button', { name: /enter edit mode/i }).click();

    const titleInput = page.locator('input[placeholder="Extension Name"]');
    await titleInput.clear();
    await titleInput.fill('Persisted Title');

    // Apply changes
    await page.getByRole('button', { name: /apply/i }).click();

    // Check localStorage was updated
    const state = await getLocalStorageState(page);
    expect(state).not.toBeNull();
    expect(state?.manifest?.app?.name).toBe('Persisted Title');
  });
});
