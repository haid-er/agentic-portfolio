/**
 * Every public page in both worlds at the project's viewport (phone-360 / desktop-1280):
 * renders, no console errors, no horizontal overflow, no axe violations.
 */
import { expect, test } from '@playwright/test'
import { expectAccessible, expectNoOverflow, openInWorld, PROJECT_SLUGS, settle, THEMES, watch } from './helpers'

const PAGES = ['/', '/projects', ...PROJECT_SLUGS.map((s) => `/projects/${s}`), '/playground', '/resume', '/admin/login']

for (const world of THEMES) {
  for (const path of PAGES) {
    test(`${path} in ${world}`, async ({ page }, info) => {
      const errors = await watch(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openInWorld(page, path, world)
      await expect(page.locator('h1').first()).toBeVisible()
      await page.waitForLoadState('networkidle').catch(() => {})
      await settle(page)
      await expectNoOverflow(page, path)
      await expectAccessible(page, info, `${path}-${world}`)
      expect(errors, `${path}: errors`).toEqual([])
    })
  }
}
