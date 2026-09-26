/**
 * Every visible demo in both worlds: the plate renders the live demo (no error
 * boundary), one basic interaction works, no console errors, no horizontal
 * overflow, no axe violations. AI routes are mocked to 503 (no quota spent) and
 * third-party hosts are blocked, so each demo's honest fallback path is exercised.
 */
import { expect, type Locator, type Page, test } from '@playwright/test'
import { DEMO_PAGES, expectAccessible, expectNoOverflow, openInWorld, settle, THEMES, watch } from './helpers'

/** Buttons that would leave the page, start a file dialog or ask for device permissions. */
const SKIP = /upload|choose file|browse|location|download|camera|microphone|sensor|motion|permission|print|sign in|delete all|reset all|open the/i

export function stage(page: Page): Locator {
  return page.locator('figure').filter({ has: page.locator('figcaption', { hasText: /Plate \d+/ }) }).first()
}

export async function demoReady(page: Page) {
  const s = stage(page)
  await expect(s).toBeVisible()
  await expect(s.getByText('Loading demo')).toHaveCount(0, { timeout: 20_000 })
  await expect(s.getByRole('alert').filter({ hasText: /stopped working/ })).toHaveCount(0)
  return s
}

async function poke(s: Locator) {
  const buttons = s.locator('button:visible:enabled')
  const n = await buttons.count()
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i)
    const label = `${(await b.innerText().catch(() => '')) ?? ''} ${(await b.getAttribute('aria-label')) ?? ''}`
    if (SKIP.test(label)) continue
    await b.click({ timeout: 5_000 })
    return label.trim()
  }
  return ''
}

for (const world of THEMES) {
  for (const slug of DEMO_PAGES) {
    test(`demo ${slug} in ${world}`, async ({ page }, info) => {
      const errors = await watch(page, { mockAi: true })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openInWorld(page, `/playground/${slug}`, world)
      await expect(page.locator('h1').first()).toBeVisible()
      const s = await demoReady(page)
      await poke(s)
      await page.waitForTimeout(800)
      await expect(s.getByRole('alert').filter({ hasText: /stopped working/ })).toHaveCount(0)
      await settle(page)
      await expectNoOverflow(page, slug)
      await expectAccessible(page, info, `${slug}-${world}`)
      expect(errors, `${slug}: errors`).toEqual([])
    })
  }
}
