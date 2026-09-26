/**
 * Hydration must be deterministic. watch() tolerates a rare production React #418
 * (a framework-level streaming-hydration flake, see helpers.ts); a real mismatch in
 * app code happens on every load (e.g. ids from a module-level counter differ after
 * the server's first request), so each page is loaded several times and more than
 * one #418 fails the test. Loads are not intercepted, and each world is covered.
 */
import { expect, type Page, test } from '@playwright/test'
import { DEMO_PAGES, HYDRATION_FLAKE, hydrated, PROJECT_SLUGS, THEMES } from './helpers'

const LOADS = 4
const PUBLIC = ['/', '/projects', `/projects/${PROJECT_SLUGS[0]}`, '/playground', `/playground/${DEMO_PAGES[0]}`, '/resume', '/admin/login', '/nope-404']
const ADMIN = ['/admin', '/admin/site?tab=hero', '/admin/site?tab=sections', '/admin/theme', '/admin/projects', '/admin/ai']
const PASSWORD = process.env.ADMIN_PASSWORD ?? ''

async function count418(page: Page, path: string): Promise<number> {
  let n = 0
  const on = (e: Error) => { if (HYDRATION_FLAKE.test(e.message)) n++ }
  page.on('pageerror', on)
  for (let i = 0; i < LOADS; i++) {
    await page.goto(path, { waitUntil: 'load' })
    await hydrated(page)
    await page.waitForTimeout(250)
  }
  page.off('pageerror', on)
  return n
}

test.describe('hydration is deterministic', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 400, 'viewport-independent: desktop project only')

  for (const world of THEMES) {
    test(`public pages in ${world}`, async ({ page }) => {
      test.setTimeout(180_000)
      const bad: string[] = []
      for (const p of PUBLIC) {
        const n = await count418(page, `${p}${p.includes('?') ? '&' : '?'}theme=${world}`)
        if (n > 1) bad.push(`${p}: #418 on ${n}/${LOADS} loads`)
      }
      expect(bad).toEqual([])
    })
  }

  test('admin pages', async ({ page }) => {
    test.skip(!PASSWORD, 'ADMIN_PASSWORD is not set')
    test.setTimeout(180_000)
    await page.goto('/admin/login?next=/admin')
    await hydrated(page)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/admin/login'))
    const bad: string[] = []
    for (const p of ADMIN) {
      const n = await count418(page, p)
      if (n > 1) bad.push(`${p}: #418 on ${n}/${LOADS} loads`)
    }
    expect(bad).toEqual([])
  })
})
