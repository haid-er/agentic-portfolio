/**
 * Content honesty and first-impression checks from the design/fact review:
 * no invented skill bands, unproven skills are labelled, folios never skip,
 * the name is read once, contact is reachable from the fold and the header,
 * and the project index puts real work before learning builds.
 */
import { expect, test } from '@playwright/test'
import site from '../content/site.json' with { type: 'json' }
import skills from '../content/skills.json' with { type: 'json' }
import { hydrated, watch } from './helpers'

test('skills: no proficiency bands; unproven skills are listed as "no demo yet", never linked', async ({ page }) => {
  const errors = await watch(page)
  await page.goto('/?theme=almanac')
  const s = page.locator('#skills')
  await expect(s).toBeVisible()
  for (const band of ['Core', 'Working', 'Exploring']) await expect(s.getByText(band, { exact: true })).toHaveCount(0)
  const unproven = (skills.items as { name: string; enabled: boolean; demoSlugs: string[] }[]).filter((i) => i.enabled && !i.demoSlugs.length)
  expect(unproven.length).toBeGreaterThan(0)
  await expect(s.getByText('No demo yet:').first()).toBeVisible()
  // An unproven skill never appears as a link (chip) to a demo.
  for (const u of unproven.slice(0, 8)) await expect(s.getByRole('link', { name: new RegExp(`^${u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('homepage folios run in sequence with no gaps', async ({ page }) => {
  await page.goto('/')
  const folios = await page.locator('main section [data-folio]').allInnerTexts()
  expect(folios.length).toBeGreaterThan(5)
  folios.forEach((f, i) => expect(Number(f), `folio ${i}: ${folios.join(',')}`).toBe(i + 2))
})

test('the hero names Malik once and offers contact above the fold', async ({ page }) => {
  await page.goto('/?theme=strata')
  await hydrated(page)
  const h1 = page.locator('h1')
  expect((await h1.innerText()).toLowerCase().trim()).toBe(site.profile.name.toLowerCase())
  const cta = page.locator('#hero').getByRole('link', { name: /get in touch/i })
  await expect(cta).toBeInViewport()
  await cta.click()
  await expect(page).toHaveURL(/#contact$/)
})

test('desktop header links Contact and never truncates the name', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'desktop header only')
  for (const world of ['almanac', 'strata']) {
    await page.goto(`/?theme=${world}`)
    await hydrated(page)
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('link', { name: /Contact/ })).toBeVisible()
    const clipped = await page.locator('header[data-shell-header] a[href="/"] .display').evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(clipped, `${world}: name truncated`).toBe(false)
  }
})

test('/projects lists real work before learning builds', async ({ page }) => {
  await page.goto('/projects')
  const headings = page.locator('main h2')
  await expect(headings.filter({ hasText: 'Work and projects' })).toHaveCount(1)
  await expect(headings.filter({ hasText: 'Learning builds' })).toHaveCount(1)
  const order = (await headings.allTextContents()).map((t) => t.toLowerCase())
  const work = order.findIndex((t) => t.startsWith('work'))
  expect(work).toBeGreaterThan(-1)
  expect(work).toBeLessThan(order.findIndex((t) => t.startsWith('learning')))
})

test('Strata home has no late font swap (CLS under 0.1)', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __cls: number }).__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto('/?theme=strata', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
  expect(cls).toBeLessThan(0.1)
  // Only the active world's fonts are preloaded.
  const preloads = await page.locator('link[rel="preload"][as="font"]').count()
  expect(preloads).toBeGreaterThan(0)
  expect(preloads).toBeLessThanOrEqual(3)
})
