import { expect, test } from '@playwright/test'

const THEMES = ['almanac', 'strata'] as const

for (const theme of THEMES) {
  test(`home renders in ${theme} without errors or horizontal overflow`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.goto(`/?theme=${theme}`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(page.locator('h1').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
    expect(errors).toEqual([])
  })
}

test('playground lists demos and a demo page loads', async ({ page }) => {
  await page.goto('/playground')
  await expect(page.locator('h1')).toBeVisible()
  const first = page.locator('a[href^="/playground/"]').first()
  await first.click()
  await expect(page).toHaveURL(/\/playground\/[a-z0-9-]+$/)
  await expect(page.locator('h1')).toBeVisible()
})

test('admin redirects to login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login/)
})
