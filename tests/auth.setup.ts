/**
 * tests/auth.setup.ts
 *
 * Playwright global setup: logs in as the coordinator test user once,
 * saves the auth state (cookies) to tests/.auth/coordinator.json.
 * All smoke tests then reuse this state instead of logging in each time.
 *
 * Required env vars (in .env.test or system env):
 *   TEST_USER_EMAIL
 *   TEST_USER_PASSWORD
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth/coordinator.json')

setup('authenticate as coordinator', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set.\n' +
      'Copy .env.test.example to .env.test and fill in credentials.',
    )
  }

  await page.goto('/auth/login')

  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()

  // After login, should land on /dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  await expect(page).toHaveURL(/\/dashboard/)

  // Persist the authenticated session
  await page.context().storageState({ path: AUTH_FILE })
})
