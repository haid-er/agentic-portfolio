/** Every internal link on every public page resolves, and every #anchor exists. */
import { expect, test } from '@playwright/test'
import { DEMO_PAGES, demoReady, PROJECT_SLUGS } from './helpers'

test.skip(({ viewport }) => (viewport?.width ?? 0) < 400, 'crawl once (desktop project)')
test.setTimeout(240_000)

const PAGES = ['/', '/projects', ...PROJECT_SLUGS.map((s) => `/projects/${s}`), '/playground', ...DEMO_PAGES.map((s) => `/playground/${s}`), '/resume', '/admin/login']

test('no broken internal links', async ({ page, request, baseURL }) => {
  const targets = new Map<string, string>() // url -> first page it was seen on
  const anchors: { from: string; path: string; id: string }[] = []
  for (const p of PAGES) {
    await page.goto(p)
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href))
    for (const h of hrefs) {
      const u = new URL(h)
      if (u.origin !== baseURL) continue
      const path = u.pathname + u.search
      if (u.hash.length > 1) anchors.push({ from: p, path: u.pathname, id: decodeURIComponent(u.hash.slice(1)) })
      if (!targets.has(path)) targets.set(path, p)
    }
  }
  const broken: string[] = []
  for (const [path, from] of targets) {
    const r = await request.get(path, { maxRedirects: 5 })
    if (r.status() >= 400) broken.push(`${path} (${r.status()}) linked from ${from}`)
  }
  const idsByPath = new Map<string, Set<string>>()
  for (const a of anchors) {
    if (!idsByPath.has(a.path)) {
      await page.goto(a.path)
      // Demos render client-side: wait for the live demo before reading its ids.
      if (a.path.startsWith('/playground/')) await demoReady(page)
      idsByPath.set(a.path, new Set(await page.$$eval('[id]', (els) => els.map((e) => e.id))))
    }
    if (!idsByPath.get(a.path)!.has(a.id)) broken.push(`${a.path}#${a.id} (missing anchor) linked from ${a.from}`)
  }
  expect(broken, 'broken internal links').toEqual([])
  expect(targets.size).toBeGreaterThan(40)
})
