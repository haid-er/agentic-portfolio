/** Shell, hero, GitHub feed, résumé and contact behaviour. */
import { expect, test } from '@playwright/test'
import site from '../content/site.json' with { type: 'json' }
import { hydrated, watch } from './helpers'

test.describe('shell', () => {
  test('Ctrl/Cmd+K opens the index; typing + Enter navigates', async ({ page }) => {
    const errors = await watch(page)
    await page.goto('/?theme=almanac')
    await hydrated(page)
    await page.keyboard.press('Control+k')
    const box = page.getByPlaceholder('Find a section, demo or page')
    await expect(box).toBeVisible()
    await box.fill('playground')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/playground/)
    expect(errors).toEqual([])
  })

  test('the index lists the projects page', async ({ page }) => {
    await page.goto('/?theme=almanac')
    await hydrated(page)
    await page.keyboard.press('Control+k')
    await page.getByPlaceholder('Find a section, demo or page').fill('/projects')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/projects$/)
  })

  test('Reprint flips the world and announces it', async ({ page }) => {
    await page.goto('/?theme=almanac')
    await hydrated(page)
    const labels = { almanac: 'Almanac', strata: 'Strata' }
    await page.getByRole('button', { name: /Switch to .* theme/ }).first().click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'strata')
    await expect(page.locator('#ghp-shell-live')).toHaveText(`${labels.strata} theme on.`)
  })
})

test.describe('phone shell', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 400, 'phone only')
  test('folio bar Contents opens the sheet; Esc closes it', async ({ page }) => {
    await page.goto('/?theme=strata')
    await hydrated(page)
    await page.getByRole('button', { name: 'Contents' }).last().click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })
})

test('hero core sample has 7 layers linked to demos', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator("#hero .gtp-core a[href^='/playground/']")).toHaveCount(7)
})

test('GitHub section is honest about its source', async ({ page }) => {
  await page.goto('/')
  const gh = page.locator('#github')
  await expect(gh.getByText(/Source: GitHub public REST API|Feed unavailable\. Nothing is estimated\./).first()).toBeVisible()
})

test('world switch replays nothing under reduced motion and keeps layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?theme=almanac')
  await hydrated(page)
  await page.getByRole('button', { name: /Switch to .* theme/ }).first().click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'strata')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
})

test.describe('résumé and contact', () => {
  test('/resume has the name and a Download PDF control; print hides chrome', async ({ page }) => {
    await page.goto('/resume')
    await expect(page.locator('h1')).toContainText(site.profile.name)
    await expect(page.getByText('Download PDF').first()).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    for (const el of await page.locator('body > :not(main)').all()) await expect(el).toBeHidden()
    await expect(page.locator('header[data-shell-header]')).toBeHidden()
  })

  test('homepage contact shows the email and a Copy button; mailto form hands over', async ({ page }) => {
    await page.goto('/')
    await hydrated(page)
    const c = page.locator('#contact')
    await expect(c.getByText(site.profile.email).first()).toBeVisible()
    await expect(c.getByRole('button', { name: /Copy email address/ })).toBeVisible()
    await c.getByLabel('Your name').fill('E2E Tester')
    await c.getByLabel('Your email').fill('tester@example.com')
    await c.getByLabel('Message').fill('Hello from the end-to-end test. This is only a check of the form.')
    await c.getByRole('button', { name: /send|mail/i }).last().click()
    await expect(c.getByText('Over to your mail app.')).toBeVisible()
  })
})
