/**
 * Deeper interaction checks for demos whose core behaviour runs offline
 * (no AI, no third parties): each proves the demo actually works, not just renders.
 */
import { expect, type Page, test } from '@playwright/test'
import { demoReady, hydrated, watch } from './helpers'

test.describe.configure({ timeout: 90_000 })

async function open(page: Page, slug: string) {
  const errors = await watch(page, { mockAi: true })
  await page.goto(`/playground/${slug}?theme=almanac`)
  await hydrated(page)
  const s = await demoReady(page)
  return { s, errors }
}

test('mcp-tool-lab: offline router runs the calculator and logs the handshake', async ({ page }) => {
  const { s, errors } = await open(page, 'mcp-tool-lab')
  await s.getByRole('radio', { name: 'Offline router' }).click()
  await s.getByRole('group', { name: 'Example requests' }).or(s.locator('[aria-label="Example requests"]')).locator('button').first().click()
  await s.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(s.getByText('451.5').first()).toBeVisible({ timeout: 15_000 })
  await expect(s.getByText('initialize').first()).toBeVisible()
  await expect(s.getByText('tools/list').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('agent-orchestra: simulated workflow completes despite the crash', async ({ page }) => {
  test.setTimeout(120_000)
  const { s, errors } = await open(page, 'agent-orchestra')
  await s.getByRole('radio', { name: 'Simulated' }).click()
  await s.getByRole('button', { name: 'Start workflow' }).click()
  await expect(s.getByText(/completed/i).first()).toBeVisible({ timeout: 60_000 })
  expect(errors).toEqual([])
})

test('ask-malik: extractive mode answers with a citation', async ({ page }) => {
  const { s, errors } = await open(page, 'ask-malik')
  await s.getByRole('radio', { name: 'Extractive (offline)' }).click()
  const suggestion = s.locator('button').filter({ hasText: /\?$/ }).first()
  await suggestion.click()
  await expect(s.getByRole('link', { name: /^Source 1:/ }).first()).toBeVisible({ timeout: 20_000 })
  expect(errors).toEqual([])
})

test('algo-visualizer: End shows the three-algorithm comparison', async ({ page }) => {
  const { s, errors } = await open(page, 'algo-visualizer')
  await s.getByRole('button', { name: 'End', exact: true }).first().click()
  const table = s.getByRole('region', { name: /Same board/ }).or(s.locator('section, div').filter({ hasText: 'Same board, three algorithms' }).locator('table')).first()
  await expect(table.locator('tbody tr')).toHaveCount(3)
  await expect(s.getByText('cheapest').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('code-judge: brute force on count primes hits the time limit', async ({ page }) => {
  const { s, errors } = await open(page, 'code-judge')
  await s.getByLabel('Choose a problem').selectOption('count-primes')
  await s.getByRole('button', { name: 'Load brute force' }).click()
  await s.getByRole('button', { name: 'Submit' }).click()
  await expect(s.getByText('Time limit exceeded').first()).toBeVisible({ timeout: 45_000 })
  expect(errors).toEqual([])
})

test('code-judge: run samples returns a verdict', async ({ page }) => {
  const { s, errors } = await open(page, 'code-judge')
  await s.getByRole('button', { name: 'Run samples' }).click()
  await expect(s.getByText(/Accepted|Wrong answer|Runtime error|Time limit exceeded|passed|failed/i).first()).toBeVisible({ timeout: 30_000 })
  expect(errors).toEqual([])
})

test('sql-playground: engine starts from this site and a challenge is accepted', async ({ page }) => {
  const { s, errors } = await open(page, 'sql-playground')
  await expect(s.getByText(/SQLite 3\.[\d.]+ · WebAssembly · engine from this site/)).toBeVisible({ timeout: 30_000 })
  await s.getByRole('radio', { name: 'Challenges' }).click()
  await s.getByLabel('Choose a challenge').selectOption('second-price')
  await s.getByLabel('Your query').fill('SELECT (\n  SELECT DISTINCT price\n  FROM products\n  ORDER BY price DESC\n  LIMIT 1 OFFSET 1\n) AS second_highest;')
  await s.getByRole('button', { name: 'Check answer' }).click()
  await expect(s.getByText('Accepted', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  expect(errors).toEqual([])
})

test('automation-recorder: replaying the sample publishes the listing', async ({ page }) => {
  const { s, errors } = await open(page, 'automation-recorder')
  await s.getByRole('button', { name: /Load sample/ }).click()
  await s.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(s.getByText(/Replay finished\. The listing was published\./).first()).toBeAttached({ timeout: 30_000 })
  expect(errors).toEqual([])
})
