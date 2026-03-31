/**
 * tests/unauthenticated.spec.ts
 *
 * Verify that protected routes redirect to /auth/login when unauthenticated.
 * These tests deliberately do NOT use the saved auth state.
 */

import { test, expect } from '@playwright/test'

// Override storageState — run these tests without auth
test.use({ storageState: { cookies: [], origins: [] } })

const protectedRoutes = [
  '/dashboard',
  '/contracts',
  '/contracts/new',
  '/buses',
  '/buses/drivers',
  '/buses/vehicles',
  '/buses/verification',
]

for (const route of protectedRoutes) {
  test(`unauthenticated: ${route} → redirects to /auth/login`, async ({ page }) => {
    await page.goto(route)
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/auth\/login/)
  })
}

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/auth/login')
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
})
