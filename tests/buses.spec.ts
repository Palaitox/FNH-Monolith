/**
 * tests/buses.spec.ts
 *
 * E2E tests for the Buses module — form submission flows.
 *
 * These tests create real records in the database against the test environment.
 * Test entities use a distinctive cedula/plate prefix (E2E_) so they are
 * easy to identify and clean up.
 *
 * Runs with coordinator auth state from auth.setup.ts.
 */

import { test, expect } from '@playwright/test'

const E2E_CEDULA = `9${Date.now().toString().slice(-8)}`
const E2E_PLATE  = `TE${Date.now().toString().slice(-4)}`

// ── Drivers ────────────────────────────────────────────────────────────────

test('buses/drivers/new — form renders required fields', async ({ page }) => {
  await page.goto('/buses/drivers/new')
  await expect(page).toHaveURL(/\/buses\/drivers\/new/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()

  await expect(page.getByRole('heading', { name: /nuevo conductor/i })).toBeVisible()

  // Both required fields must be present
  await expect(page.getByPlaceholder(/Juan Carlos/i)).toBeVisible()
  await expect(page.getByPlaceholder(/1234567890/i)).toBeVisible()
})

test('buses/drivers/new — validation blocks empty submit', async ({ page }) => {
  await page.goto('/buses/drivers/new')

  await page.getByRole('button', { name: /guardar conductor/i }).click()

  // Client-side validation error should appear without page navigation
  await expect(page.getByText(/nombre es requerido/i)).toBeVisible()
  await expect(page).toHaveURL(/\/buses\/drivers\/new/)
})

test('buses/drivers/new — submit creates driver and redirects to detail', async ({ page }) => {
  await page.goto('/buses/drivers/new')

  await page.getByPlaceholder(/Juan Carlos/i).fill('CONDUCTOR E2E TEST')
  await page.getByPlaceholder(/1234567890/i).fill(E2E_CEDULA)

  await page.getByRole('button', { name: /guardar conductor/i }).click()

  // Should redirect to /buses/drivers/{uuid}
  await page.waitForURL(/\/buses\/drivers\/[a-f0-9-]{36}/, { timeout: 15_000 })
  await expect(page).toHaveURL(/\/buses\/drivers\//)

  // Detail page should show the driver's name
  await expect(page.getByText('CONDUCTOR E2E TEST')).toBeVisible()
})

// ── Vehicles ───────────────────────────────────────────────────────────────

test('buses/vehicles/new — form renders required fields', async ({ page }) => {
  await page.goto('/buses/vehicles/new')
  await expect(page).toHaveURL(/\/buses\/vehicles\/new/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()

  await expect(page.getByRole('heading', { name: /nuevo veh[ií]culo/i })).toBeVisible()
  await expect(page.getByPlaceholder(/ABC123/i)).toBeVisible()
})

test('buses/vehicles/new — validation blocks empty submit', async ({ page }) => {
  await page.goto('/buses/vehicles/new')

  await page.getByRole('button', { name: /guardar veh[ií]culo/i }).click()

  await expect(page.getByText(/placa es requerida/i)).toBeVisible()
  await expect(page).toHaveURL(/\/buses\/vehicles\/new/)
})

test('buses/vehicles/new — submit creates vehicle and redirects to detail', async ({ page }) => {
  await page.goto('/buses/vehicles/new')

  await page.getByPlaceholder(/ABC123/i).fill(E2E_PLATE)

  // Keep default type "titular"
  await page.getByRole('button', { name: /guardar veh[ií]culo/i }).click()

  await page.waitForURL(/\/buses\/vehicles\/[a-f0-9-]{36}/, { timeout: 15_000 })
  await expect(page).toHaveURL(/\/buses\/vehicles\//)

  // Detail page should show the plate
  await expect(page.getByText(E2E_PLATE)).toBeVisible()
})

// ── Verification ───────────────────────────────────────────────────────────

test('buses/verification/new — form renders with driver/vehicle selects', async ({ page }) => {
  await page.goto('/buses/verification/new')
  await expect(page).toHaveURL(/\/buses\/verification\/new/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()

  await expect(page.getByRole('heading', { name: /nueva verificaci[oó]n/i })).toBeVisible()

  // Both selects and the date field must render
  await expect(page.getByText(/conductor/i).first()).toBeVisible()
  await expect(page.getByText(/veh[ií]culo/i).first()).toBeVisible()
  await expect(page.getByText(/fecha de verificaci[oó]n/i)).toBeVisible()
})

test('buses/verification/new — validation blocks submit without driver', async ({ page }) => {
  await page.goto('/buses/verification/new')

  await page.getByRole('button', { name: /crear verificaci[oó]n/i }).click()

  await expect(page.getByText(/selecciona un conductor/i)).toBeVisible()
  await expect(page).toHaveURL(/\/buses\/verification\/new/)
})

// ── Contracts import ───────────────────────────────────────────────────────

test('contracts/import — renders file upload zone', async ({ page }) => {
  await page.goto('/contracts/import')
  await expect(page).toHaveURL(/\/contracts\/import/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()

  await expect(page.getByRole('heading', { name: /importar empleados/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /seleccionar archivo/i })).toBeVisible()
})

// ── Contracts templates ────────────────────────────────────────────────────

test('contracts/templates — renders template list and upload form', async ({ page }) => {
  await page.goto('/contracts/templates')
  await expect(page).toHaveURL(/\/contracts\/templates/)

  const errorOverlay = page.locator('[data-nextjs-dialog]')
  await expect(errorOverlay).not.toBeVisible()

  await expect(page.getByRole('heading', { name: /plantillas/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /subir plantilla/i })).toBeVisible()
})

// ── List pages include action links ───────────────────────────────────────

test('contracts list has links to import and templates', async ({ page }) => {
  await page.goto('/contracts')

  await expect(page.getByRole('link', { name: /importar empleados/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /plantillas/i })).toBeVisible()
})
