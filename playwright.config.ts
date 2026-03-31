import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.test' })

/**
 * E2E test config for FNH Monolith.
 *
 * Requires:
 *   TEST_USER_EMAIL    — a coordinator-role user
 *   TEST_USER_PASSWORD — matching password
 *   TEST_ADMIN_EMAIL   — an admin-role user (for admin-only action tests)
 *   TEST_ADMIN_PASSWORD
 *
 * Copy .env.test.example to .env.test and fill in values.
 * Never commit .env.test.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,   // sequential to avoid auth state races
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Step 1: save coordinator auth state to file
    {
      name: 'setup-coordinator',
      testMatch: /auth\.setup\.ts/,
    },

    // Step 2: run smoke tests using saved auth state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/coordinator.json',
      },
      dependencies: ['setup-coordinator'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
