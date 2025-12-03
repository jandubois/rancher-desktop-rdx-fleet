import { test as base, expect, Page } from '@playwright/test';

/**
 * E2E test fixtures with mocked Docker extension API and services.
 *
 * The app architecture uses dependency injection via ServiceContext,
 * and the Docker extension API is imported from @docker/extension-api-client.
 * In the Vite dev server, this is already aliased to a mock (see vitest.config.ts).
 *
 * For E2E tests we:
 * 1. Mock HTTP requests via page.route() for GitHub/AppCo API calls
 * 2. Set up localStorage state as needed
 * 3. The app's mock ddClient handles CLI commands (kubectl, helm, etc.)
 */

/** Mock data for Fleet status responses */
export const MockFleetData = {
  /** Fleet is installed and running */
  running: {
    status: 'running' as const,
    message: 'Fleet is running',
    details: {
      fleetController: { ready: true, replicas: 1 },
      fleetAgent: { ready: true, replicas: 1 },
    },
  },
  /** Fleet is not installed */
  notInstalled: {
    status: 'not-installed' as const,
    message: 'Fleet is not installed',
  },
  /** Fleet is checking */
  checking: {
    status: 'checking' as const,
    message: 'Checking Fleet status...',
  },
};

/** Mock GitRepo data */
export const MockGitRepos = {
  empty: [] as unknown[],
  singleRepo: [
    {
      name: 'test-bundles',
      repo: 'https://github.com/test-org/test-bundles',
      branch: 'main',
      paths: [],
    },
  ],
  multipleRepos: [
    {
      name: 'test-bundles',
      repo: 'https://github.com/test-org/test-bundles',
      branch: 'main',
      paths: ['charts/app1'],
    },
    {
      name: 'infra-configs',
      repo: 'https://github.com/test-org/infra-configs',
      branch: 'main',
      paths: [],
    },
  ],
};

/** Mock path discovery data */
export const MockPathDiscovery = {
  simpleApp: {
    paths: ['charts/app1', 'charts/app2', 'manifests/base'],
    dependencies: {},
  },
  withDependencies: {
    paths: ['charts/app1', 'charts/app2', 'manifests/base', 'manifests/common'],
    dependencies: {
      'charts/app1': ['manifests/base'],
      'charts/app2': ['manifests/base', 'manifests/common'],
    },
  },
};

/** Helper to set up initial localStorage state */
export async function setupLocalStorage(
  page: Page,
  state: {
    manifest?: Record<string, unknown>;
    manifestCards?: unknown[];
    cardOrder?: string[];
    dynamicCardTitles?: Record<string, string>;
  }
) {
  // Use addInitScript with a guard to only set up state once.
  // We use a separate localStorage key as a flag to track if setup has been done.
  // This survives page reloads and prevents overwriting app state.
  await page.addInitScript(
    (state) => {
      const STORAGE_KEY = 'fleet-extension-state:default';
      const SETUP_FLAG_KEY = '__e2e_initial_setup_done__';

      // If setup was already done, don't overwrite app state
      if (localStorage.getItem(SETUP_FLAG_KEY)) {
        return;
      }

      // Mark setup as done
      localStorage.setItem(SETUP_FLAG_KEY, 'true');

      const extensionState = {
        manifest: state.manifest ?? {
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
        manifestCards: state.manifestCards ?? [],
        cardOrder: state.cardOrder ?? ['fleet-status'],
        dynamicCardTitles: state.dynamicCardTitles ?? {},
        iconState: null,
        timestamp: Date.now(),
      };
      // Key must match the app's storage key format: 'fleet-extension-state:{extensionImage}'
      // When running outside Docker Desktop, detectCurrentExtensionImage() returns null,
      // which results in the key 'fleet-extension-state:default'
      localStorage.setItem(STORAGE_KEY, JSON.stringify(extensionState));
    },
    state
  );
}

/** Helper to clear localStorage */
export async function clearLocalStorage(page: Page) {
  // Use addInitScript with a guard to only clear once.
  // This prevents clearing app state on page reload.
  await page.addInitScript(() => {
    const CLEAR_FLAG_KEY = '__e2e_clear_done__';

    // If clear was already done, don't clear again
    if (localStorage.getItem(CLEAR_FLAG_KEY)) {
      return;
    }

    // Mark clear as done BEFORE clearing (so it persists)
    // We need to clear everything EXCEPT our flag
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key !== CLEAR_FLAG_KEY) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(CLEAR_FLAG_KEY, 'true');
  });
}

/** Helper to get current localStorage state */
export async function getLocalStorageState(page: Page) {
  return await page.evaluate(() => {
    // Key must match the app's storage key format
    const state = localStorage.getItem('fleet-extension-state:default');
    return state ? JSON.parse(state) : null;
  });
}

/** Mock GitHub API responses */
export async function mockGitHubApi(page: Page, options?: { rateLimitRemaining?: number }) {
  // Mock rate limit endpoint
  await page.route('**/api.github.com/rate_limit', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rate: {
          limit: 60,
          remaining: options?.rateLimitRemaining ?? 60,
          reset: Math.floor(Date.now() / 1000) + 3600,
        },
      }),
    });
  });

  // Mock repository contents for path discovery
  await page.route('**/api.github.com/repos/**/contents/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'charts', type: 'dir' },
        { name: 'manifests', type: 'dir' },
        { name: 'README.md', type: 'file' },
      ]),
    });
  });
}

/**
 * Extended test fixture with helper methods for E2E tests.
 */
export const test = base.extend<{
  /** Set up app with default state (Fleet running, no repos) */
  setupApp: () => Promise<void>;
  /** Set up app with Fleet running and sample repos */
  setupAppWithRepos: () => Promise<void>;
  /** Helper to enter edit mode */
  enterEditMode: () => Promise<void>;
  /** Helper to exit edit mode with Apply */
  applyEditMode: () => Promise<void>;
  /** Helper to exit edit mode with Cancel */
  cancelEditMode: () => Promise<void>;
}>({
  setupApp: async ({ page }, use) => {
    const setup = async () => {
      await clearLocalStorage(page);
      await mockGitHubApi(page);
      await page.goto('/');
      // Wait for the app to render (don't use networkidle - polling prevents it from ever being idle)
      await page.waitForLoadState('load');
    };
    await use(setup);
  },

  setupAppWithRepos: async ({ page }, use) => {
    const setup = async () => {
      // Set up state with repos already configured
      await setupLocalStorage(page, {
        cardOrder: ['fleet-status', 'gitrepo-test-bundles'],
        dynamicCardTitles: {
          'fleet-status': 'Fleet Status',
          'gitrepo-test-bundles': 'Test Bundles',
        },
      });
      await mockGitHubApi(page);
      await page.goto('/');
      // Wait for the app to render (don't use networkidle - polling prevents it from ever being idle)
      await page.waitForLoadState('load');
    };
    await use(setup);
  },

  enterEditMode: async ({ page }, use) => {
    const enter = async () => {
      // Click the edit button in the header
      await page.getByRole('button', { name: /enter edit mode/i }).click();
      // Wait for edit mode UI to appear
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /apply/i })).toBeVisible();
    };
    await use(enter);
  },

  applyEditMode: async ({ page }, use) => {
    const apply = async () => {
      await page.getByRole('button', { name: /apply/i }).click();
      // Wait for edit mode to exit
      await expect(page.getByRole('button', { name: /enter edit mode/i })).toBeVisible();
    };
    await use(apply);
  },

  cancelEditMode: async ({ page }, use) => {
    const cancel = async () => {
      await page.getByRole('button', { name: /cancel/i }).click();
      // Wait for edit mode to exit
      await expect(page.getByRole('button', { name: /enter edit mode/i })).toBeVisible();
    };
    await use(cancel);
  },
});

export { expect };

/**
 * Helper to perform drag-and-drop in Playwright.
 * Uses the @dnd-kit drag handles which are visible in edit mode.
 */
export async function dragCard(
  page: Page,
  sourceCardTestId: string,
  targetCardTestId: string
) {
  const source = page.locator(`[data-testid="${sourceCardTestId}"] [data-testid="drag-handle"]`);
  const target = page.locator(`[data-testid="${targetCardTestId}"]`);

  // Get bounding boxes
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('Could not find source or target elements for drag');
  }

  // Perform drag operation
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();

  // Move to target location (above the target card)
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + 10, // Just above the target
    { steps: 10 } // Smooth movement for better DnD detection
  );

  await page.mouse.up();

  // Wait for reorder animation to complete
  await page.waitForTimeout(300);
}
