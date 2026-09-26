import { test } from '@playwright/test'
import { PROJECT_SLUGS } from './helpers'
const paths = ['/admin/login', '/playground/algo-visualizer', '/playground/dispatch-board', '/resume', ...PROJECT_SLUGS.map((s) => `/projects/${s}`)]
for (let w = 0; w < 12; w++) test(`probe ${w}`, async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => {
    const w = window as unknown as { __hyd: string }
    w.__hyd = ''
    const t0 = performance.now()
    const id = setInterval(() => {
      const main = document.getElementById('main')
      if (main && Object.keys(main).some((k) => k.startsWith('__reactFiber'))) {
        w.__hyd = `hydrated at ${Math.round(performance.now() - t0)}ms readyState=${document.readyState} bodyKids=${document.body?.children.length}`
        clearInterval(id)
      }
    }, 1)
    document.addEventListener('DOMContentLoaded', () => { (window as unknown as { __dcl: number }).__dcl = Math.round(performance.now() - t0) })
  })
  let hit = ''
  page.on('pageerror', (e) => { if (/418/.test(e.message)) hit = 'x' })
  await page.route((u) => !/localhost/.test(u.toString()), (r) => r.abort())
  for (let i = 0; i < 3; i++) for (const p of paths) {
    hit = ''
    await page.goto(`${p}?theme=strata`)
    await page.waitForTimeout(200)
    const info = await page.evaluate(() => `${(window as unknown as { __hyd: string }).__hyd} dcl=${(window as unknown as { __dcl: number }).__dcl}`)
    console.log(hit ? 'HIT ' : 'ok  ', p, info)
  }
})
