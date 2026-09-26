/**
 * Admin: login, edit one field, save (disk mode: the e2e server runs without
 * GITHUB_TOKEN, so saves write content/<name>.json), then revert and confirm the
 * file is byte-identical to where it started.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { expectAccessible, expectNoOverflow, hydrated, watch } from './helpers'

const PASSWORD = process.env.ADMIN_PASSWORD ?? ''
const SITE_JSON = join(process.cwd(), 'content', 'site.json')

async function login(page: Page, next = '/admin') {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`)
  await hydrated(page)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/admin/login'))
}

test.describe('admin', () => {
  test.skip(!PASSWORD, 'ADMIN_PASSWORD is not set')

  test('wrong password is refused honestly', async ({ page }) => {
    await page.goto('/admin/login')
    await hydrated(page)
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.locator('[aria-live="assertive"] p')).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard and an editor render without errors, overflow or axe violations', async ({ page }, info) => {
    const errors = await watch(page)
    await login(page)
    await expect(page.locator('h1').first()).toBeVisible()
    await expectNoOverflow(page, 'admin dashboard')
    await expectAccessible(page, info, 'admin-dashboard')
    await page.goto('/admin/site?tab=hero')
    await hydrated(page)
    await expect(page.getByLabel('Plate note')).toBeVisible()
    await expectNoOverflow(page, 'admin site editor')
    await expectAccessible(page, info, 'admin-site-hero')
    expect(errors).toEqual([])
  })

  test('edit one field -> local save writes content -> revert', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 400, 'writes content/: run once (desktop project)')
    const original = readFileSync(SITE_JSON, 'utf8')
    const errors = await watch(page)
    await login(page, '/admin/site?tab=hero')
    await expect(page).toHaveURL(/\/admin\/site/)
    await hydrated(page)
    const field = page.getByLabel('Plate note')
    const before = await field.inputValue()
    const marker = `${before} [e2e ${Date.now()}]`
    const save = page.getByRole('button', { name: /^Save/ }).first()

    try {
      await field.fill(marker)
      await save.click()
      await expect.poll(() => readFileSync(SITE_JSON, 'utf8'), { timeout: 15_000 }).toContain(marker)
      const saved = JSON.parse(readFileSync(SITE_JSON, 'utf8'))
      expect(saved.hero.plateNote).toBe(marker)
      await expect(save).toBeEnabled()
    } finally {
      await field.fill(before)
      await save.click()
      await expect.poll(() => readFileSync(SITE_JSON, 'utf8'), { timeout: 15_000 }).toBe(original)
    }
    expect(errors).toEqual([])
  })
})
