/**
 * tests/smoke.spec.ts
 *
 * Authenticated smoke tests for key user flows.
 * Runs with the coordinator auth state saved by auth.setup.ts.
 *
 * These are not exhaustive — they verify that each major page
 * renders without a crash and shows its essential structure.
 */

import { test, expect } from '@playwright/test'

// ── Dashboard ──────────────────────────────────────────────────────────────

test('dashboard loads and shows navigation', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)

  // Navigation shell should be visible (exact nav link names)
  await expect(page.getByRole('link', { name: 'Contratos', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buses', exact: true })).toBeVisible()
})

// ── Contracts ──────────────────────────────────────────────────────────────

test('contracts list renders without error', async ({ page }) => {
  await page.goto('/contracts')
  await expect(page).toHaveURL(/\/contracts/)

  // The page should not show a Next.js error overlay
  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()

  // At minimum, the page title / heading should be present
  await expect(page.getByRole('heading', { name: /contratos/i })).toBeVisible()
})

test('contracts/new renders the creation form', async ({ page }) => {
  await page.goto('/contracts/new')
  await expect(page).toHaveURL(/\/contracts\/new/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()
})

// ── Buses ──────────────────────────────────────────────────────────────────

test('buses hub renders without error', async ({ page }) => {
  await page.goto('/buses')
  await expect(page).toHaveURL(/\/buses/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()
})

test('buses/drivers list renders without error', async ({ page }) => {
  await page.goto('/buses/drivers')
  await expect(page).toHaveURL(/\/buses\/drivers/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()

  await expect(page.getByRole('heading', { name: /conductores/i })).toBeVisible()
})

test('buses/vehicles list renders without error', async ({ page }) => {
  await page.goto('/buses/vehicles')
  await expect(page).toHaveURL(/\/buses\/vehicles/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()

  await expect(page.getByRole('heading', { name: /veh[ií]culos/i })).toBeVisible()
})

test('buses/verification list renders without error', async ({ page }) => {
  await page.goto('/buses/verification')
  await expect(page).toHaveURL(/\/buses\/verification/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()
})

// ── Navigation ─────────────────────────────────────────────────────────────

test('nav links navigate between modules', async ({ page }) => {
  await page.goto('/dashboard')

  // Click Contratos in nav → go to contracts list
  await page.getByRole('link', { name: 'Contratos', exact: true }).click()
  await expect(page).toHaveURL(/\/contracts/)

  // Click Buses in nav → go to buses hub
  await page.getByRole('link', { name: 'Buses', exact: true }).click()
  await expect(page).toHaveURL(/\/buses/)

  // Click Panel in nav → back to dashboard
  await page.getByRole('link', { name: 'Panel', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/)
})
