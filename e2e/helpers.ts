import AxeBuilder from '@axe-core/playwright'

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]['page']
import { expect, type Page, type TestInfo } from '@playwright/test'
import projects from '../content/projects.json' with { type: 'json' }
import playground from '../content/playground.json' with { type: 'json' }
import { DEMO_SLUGS } from '../lib/demos/slugs'

export const THEMES = ['almanac', 'strata'] as const
export type World = (typeof THEMES)[number]

export const PROJECT_SLUGS = (projects.items as { slug: string; enabled: boolean }[]).filter((p) => p.enabled).map((p) => p.slug)
const hidden = new Set((playground.demos as { slug: string; enabled: boolean }[]).filter((d) => !d.enabled).map((d) => d.slug))
export const DEMO_PAGES = DEMO_SLUGS.filter((s) => !hidden.has(s))

const isLocal = (url: string) => /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|data:|blob:|about:)/.test(url) || url === ''

/**
 * Collects page errors and console errors. Requests to other origins are aborted
 * (the sandbox has no reliable outbound network, and tests must not depend on third
 * parties); the browser's own "Failed to load resource" line for those is ignored,
 * and so is a 503 from a mocked AI route. Anything else is a failure.
 */
export async function watch(page: Page, opts: { blockExternal?: boolean; mockAi?: boolean } = {}) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    const at = m.location().url ?? ''
    if (/Failed to load resource/.test(text) && (!isLocal(at) || (opts.mockAi && /\/api\/ai\//.test(at)))) return
    // A blocked third-party fetch surfaces as a network TypeError in some libraries' logs.
    if (opts.blockExternal !== false && /net::ERR_FAILED|ERR_BLOCKED_BY_CLIENT|Failed to fetch/.test(text)) return
    errors.push(`console: ${text}${at ? ` @ ${at}` : ''}`)
  })
  if (opts.blockExternal !== false) {
    await page.route((url) => !isLocal(url.toString()), (route) => route.abort('blockedbyclient'))
  }
  if (opts.mockAi) {
    // Never spend real provider quota from e2e: the gateway answers "unavailable",
    // which every AI demo must handle honestly (CONTRACTS 5).
    await page.route(/\/api\/ai\/(chat|object)/, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unavailable', message: 'AI is switched off in this test run.' } }) }),
    )
  }
  return errors
}

export async function openInWorld(page: Page, path: string, world: World) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await page.goto(`${path}${sep}theme=${world}`, { waitUntil: 'load' })
  expect(res?.status(), `${path} status`).toBeLessThan(400)
  await expect(page.locator('html')).toHaveAttribute('data-theme', world)
  await hydrated(page)
  return res
}

export async function expectNoOverflow(page: Page, what: string) {
  const o = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const sw = document.documentElement.scrollWidth
    let culprit = ''
    if (sw > vw + 1) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const r = el.getBoundingClientRect()
        if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
          culprit = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)} right=${Math.round(r.right)}`
          break
        }
      }
    }
    return { vw, sw, culprit }
  })
  expect(o.sw, `${what}: horizontal overflow ${o.sw} > ${o.vw} (${o.culprit})`).toBeLessThanOrEqual(o.vw + 1)
}

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * axe in two passes. Pass 1: every WCAG A/AA rule except target-size. Pass 2:
 * target-size with fixed and sticky chrome put back in flow, so a target that only
 * happens to sit under the folio bar or sticky header at this scroll position is
 * not reported (scrolling reveals it), while every real target is still measured.
 */
export async function expectAccessible(page: Page, info: TestInfo, what: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  const main = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).disableRules(['target-size']).analyze()
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const pos = getComputedStyle(el).position
      if (pos === 'fixed' || pos === 'sticky') { el.dataset.e2ePos = el.style.position; el.style.setProperty('position', 'static', 'important') }
    }
  })
  const size = await new AxeBuilder({ page: page as unknown as AxePage }).withRules(['target-size']).analyze()
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-e2e-pos]'))) { el.style.position = el.dataset.e2ePos ?? ''; delete el.dataset.e2ePos }
  })
  const violations = [...main.violations, ...size.violations]
  const bad = violations.map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
  if (bad.length) await info.attach(`axe-${what}`, { body: JSON.stringify(violations, null, 2), contentType: 'application/json' })
  expect(bad, `${what}: axe violations`).toEqual([])
}

/** Let reveal/entrance animations finish so contrast is measured on final colours. */
export async function settle(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(150)
}

/** Wait until React has hydrated the page (the fiber key lands on #main), so tests never race hydration. */
export async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('main') ?? document.body.firstElementChild
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber'))
  }, undefined, { timeout: 20_000 })
}
