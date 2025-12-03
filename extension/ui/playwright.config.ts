import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for E2E tests.
 *
 * These tests run in a real browser with mocked Docker extension APIs,
 * allowing us to test complex UI interactions that jsdom cannot handle:
 * - Drag-and-drop card reordering
 * - Multi-step dialog flows
 * - Edit mode snapshot/restore
 * - localStorage persistence
 */

// Browser args differ between local VM and GitHub CI
// --single-process is needed in local VMs due to IPC permission issues
// but causes crashes in GitHub CI due to resource exhaustion
const isCI = !!process.env.CI;
const isGitHubActions = !!process.env.GITHUB_ACTIONS;

// Base args for sandboxed environments
const baseArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
];

// Add --single-process for local VM environments (not GitHub CI)
// This is required due to IPC permission restrictions in VMs
const chromiumArgs = isGitHubActions ? baseArgs : [...baseArgs, '--single-process'];

// Use the full Chromium browser (not headless_shell) for better stability
const chromiumPath = path.join(
  process.env.HOME || '',
  '.cache/ms-playwright/chromium-1194/chrome-linux/chrome'
);

export default defineConfig({
  testDir: './e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: isCI,

  /* Retry on CI only */
  retries: isCI ? 2 : 0,

  /* Limit parallel workers to avoid browser crashes in single-process mode */
  /* Using single worker for local VMs (--single-process mode) and CI */
  workers: 1,

  /* Reporter to use */
  reporter: isCI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'never' }]],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: chromiumPath,
          args: chromiumArgs,
          env: {
            ...process.env,
            TMPDIR: process.env.HOME + '/tmp',
          },
        },
      },
    },
    // Uncomment to add more browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run the dev server before starting tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
  },
});
